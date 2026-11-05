// TRADECRAFT sim: an extraction, the first of the kinetic missions (DESIGN.md, The kinetic missions (0.2.0 candidates):
// Extraction; the user, 2026-11-04: "agent and burned officers extraction"; its frame, its tasking and its folding back are
// sim/kinetic.js's). Systems over scripts: what happens comes of the street's own (perception, the crowd, the police and the
// emergency services and the hunt, scenario.police; a surveillance team on you, sim/scenarios/sdr.js), the posting's safe
// houses, the disguises, the fight; this scene adds the one you're bringing out, the men looking for them, and the car.
//
// **The first minute** is the job. Whoever was on you when you began it (a.tailedBy: the hub's, sim/scenarios/campaign.js
// begin()) is on you still (sc.tail: being tailed's team, sim/scenarios/sdr.js): one of them who sees you beside them
// (teamLink()) has your face, and theirs, and calls it in. Shake them before the bench.
// **The bench** (phase 'wait'): whoever's to be brought out (state.people.comp: an asset of the network, or a colleague under a
// legend of their own) comes along the path to it ARRIVE_S before the hour, from ARRIVE_M off on the side away from you
// (arriveTick()), and sits on it till PICKUP_WAIT_MIN after; T beside them (MEET_M) is the word (an asset knows your face; a
// colleague answers the parole: yours, then theirs), you sit a minute (SIT_S, the clock on SIT_SKIP_S), and they get up when
// you do. Not met by then, they go home ('missed'). A man of theirs may be there already (posts.pickup: watching the asset to
// see who comes, POST_FROM_M off, beyond a good look at you): he has the face all along, and goes after them when they get up.
// **The danger signal**: with
// a reason you know of (him, made; a tail on you, marked), from SIGNAL_M off and in their sight, T waves them off (signal()):
// they get up and go home the long way, he goes after them, and the fallback is another bench (fallbackPlace()) FALLBACK_MIN
// on, the way out's hours with it; once. You sit beside them a minute when you meet (me.busy 'meet'), as anyone on a bench.
// **With you** (phase 'with'): at your heel (compThink(): the engine's follower in heel mode, sim/agents.js, KEEP_M behind,
// in your footsteps: across the road where you crossed, up the lane you took; hurrying when they're far or have lost sight
// of you, which shows), at their own pace (their age and fitness: slower than your walk, about your stroll), as far as
// they've seen you go (out of their sight, to where they last saw you, and stood there; LOST_S of that and LOST_M apart,
// you've lost each other). Into a shop, a taxi (onBoard(): at the moment you get in), onto a bus or the metro with you if
// they're WITH_M from you, or RIDE_WITH_M and following you: inside with you is beside you. F's never over them (ai.noReach).
// **Frightened** (sc.fear, 0–100, from FEAR0; fearTick()): by what they can see and hear, never by what they can't: one of
// theirs coming at them in their sight (FEAR_CLOSE a second), a uniform close in their sight (FEAR_UNIFORM each), a police
// car's lights in sight (FEAR_SIREN), you past FAR_M (FEAR_FAR) or out of their sight (FEAR_ALONE), a shot heard (FEAR_SHOT).
// Beside you, they settle (FEAR_EASE, to FEAR_REST), whatever's out there; a word from you (T within CALM_M, CALM_S apart:
// your Social against CALM_DC); a safe house's tea (TEA_FEAR). A frightened face shows (FEAR_MODS on their looks). Past
// BOLT_FEAR they may bolt (BOLT_P a point past it, a second): off at a run, BOLT_M away from whatever frightens them, the
// pointer on them; caught up with (T within reach) they come back, steadier for STEADY_S (half the fright, no bolt). Never
// while they're out of sight with you.
// **Them** (the opposition, sc.opp: each a searcher, a post, or a patrol officer of the engine's, sim/police.js):
//   - **Searchers** (m.searchers: by the country's counter-intelligence and the heat; REINFORCE_MIN one more, REINFORCE_MAX
//     at most): plain-clothes men of the service with the photograph, on search legs (leg()) round where the companion was
//     last known (sc.anchor, SEARCH_ROWS from the bench), wider as the time goes (LEG_GROW_M a minute; LEG_ROWS streets, one
//     more every ROWS_GROW_MIN); after news on the radio (sc.lastSeen), there. Time in a safe house moves them on (skipInside()).
//   - **The evening news** (tip()): a face from it phoned in by someone who saw them, one in TIP_MIN minutes in the open by
//     how like the photograph they look (exposure(): other clothes EXPOSE_CLOTHES, a face or a kit EXPOSE_K × its quality),
//     fewer with nobody about (TIP_EMPTY): the searchers make for there. Time in the street costs; a safe house stops it.
//   - **Posts**: a man at the bench (above) and one by the way out (OUT_POST_M from the car, reading every face that passes),
//     stood; the recce may have shown you them (sim/kinetic.js recce()).
//   - **Patrols**: the engine's (sim/police.js), each with the photograph from the shift change (BOLO_MOD); one who knew them
//     and lost them is the patrol's again (a.scene cleared).
// **A look** (look()): whoever of them has the companion in sight within SEE_M (COP_SEE_M an officer) looks once, and
// again LOOK_AGAIN_S on, or once more when they come within CLOSE_M: their Awareness against the companion's Deception: the
// photograph (PHOTO_MOD; a post +2 more; a patrol officer's, BOLO_MOD, better known every BOLO_GROW_MIN); a colleague's a face
// they've had under watch (WATCHED_MOD); their clothes not the photograph's (sim/hunt.js wearOf(): CLOTHES_MOD), a kit's hair
// and glasses (KIT_K × its quality), a face (sim/disguise.js: ADV_MOD × its quality, unless a good eye reads through it,
// ADV_SEEN); the dark, the dusk; people round them; the distance; running, hurrying; fear; walking beside you (WITH_MOD: a
// couple isn't the description); the weather's hoods. Their rolls are hidden till the end, or shown if you know the man.
// **Known** (W.knows): he follows (the engine's follower, sim/agents.js: their trail, through a lane, on a shop's door; a
// searcher TRAIL_KEEP_M back, the bench's post FOLLOW_KEEP_M, beyond a good look at you; lost, or out of his sight LOSE_S,
// he's lost them), radios it (a searcher at once; the bench's post once he's seen where they're going, POST_RADIO_S: a
// minute and a half to lose him in), and closes in once another of theirs is near (BACKUP_M), or on his own CLOSE_ALONE_S
// on (the post CLOSE_AFTER_S); an officer at once. At TAKE_M he takes hold (sc.held): TAKE_S of papers, the radio and the
// cuffs. Within reach of him (REACH_T_M), the moment's yours (a reflex: go in, the fight's first edge yours; or F on him); won,
// he's down and they're free; lost, they have you both ('captured': sim/prison.js caught()); let be, they take them
// ('taken'). Whoever of theirs knows them and has a good look at you beside them (linkable(): you within LINK_M of them, him
// within LINK_SEE_M of you, your face to him: within FACE_M, or ahead of where you're looking) has your face beside theirs
// (sc.linked): your description out at once (the engine's hunt,
// sim/hunt.js HUNTS.exfil), heat when it's folded back (sim/kinetic.js), and arrested with it, no legend holds.
// **You see them too** (spot()): one of theirs in your view within SPOT_M, your Awareness against his Deception, once: made,
// you know him for theirs (the plaque over him, the instinct's warnings). A uniform is known for what it is.
// **A safe house** (the posting's, not blown: T at its door with them beside you): in, both, out of sight; its card (the
// bus's 'safehouse', its keys 'desk:safe:<key>'): other clothes for them (CHANGE_MIN), your kit on them (KIT_MIN; its
// quality yours, ON_OTHER_K of it), a face the disguise officer left there for them (ADV_ON_MIN), your own face (ADV_ON_MIN),
// tea with the lights off (TEA_MIN: their fear down); each its time skipped; out again (T inside: the card again). Seen going
// in by one who knows them, it's theirs: he's on its pavement when you come out, he looks again, and the posting's cable says
// it's blown the morning after (sc.houseSeen, folded back: sim/kinetic.js, sim/campaign.js pass()).
// **The way out** (m.out): a car the station's (or the Center's) sent to wait at the south kerb OUT_ROWS streets off
// (sim/traffic.js waitingCar(): it comes along the lane, pulls in, and waits), its driver out on the pavement by it once it's
// stopped, from m.outFrom till m.outUntil (kinetic.js OUT_WINDOW: an undercover officer's diplomatic car an hour, often
// watched; an illegal's van ten minutes, and round the block CIRCLE_S whenever one of theirs is within VAN_NERVE_M of it).
// T at it with them beside you: they're in, and it drives off along the lane (sim/traffic.js letGo(); 'out', LEAVE_S on).
// Watched getting in by one who knows them, the car's stopped two streets on ('taken'). Gone past its hour: 'stranded'.
// A ride with them seen by one who knows them (KEPT_P): the plate, the bus's number, on the radio; at the other end, they come.
// Outcomes: out, taken, captured, killed (them), dead (you), bolted (lost while running), lost (walked away from), missed,
// stranded; folded back by sim/kinetic.js foldMission().
import { TICK_MS, MIN, SEC, clockText, dateText } from '../clock.js';
import { sheet, describe } from '../people.js';
import { heatKey, addHeat } from '../heat.js';
import { say, speak } from '../log.js';
import { townOf, cityById } from '../cities/index.js';
import { weatherMods } from '../weather.js';
import { strain } from '../needs.js';
import { settle } from '../instinct.js';
import { skill } from '../skills.js';
import { opposed, check } from '../checks.js';
import { range, int, chance, pick, stream, hash } from '../rng.js';
import { Z, SECTION_M, streetName, placeName } from '../map/street.js';
import { sectionOf, routeFrom, LINE } from '../city.js';
import { makeAgent, setRoute, rowOf, onMap, follow } from '../agents.js';
import { seesActor, inView, lightHere } from '../perception.js';
import { lightBand } from '../light.js';
import { offer } from '../reflex.js';
import { whoOf, wearOf, start as startHunt } from '../hunt.js';
import { advancedOf, readThrough, wearAdvanced, ADV_MOD, ADV_SEEN, ADV_ON_MIN, quality as kitQuality, LOOKS } from '../disguise.js';
import { caught } from '../prison.js';
import { callOf, debugMission } from '../kinetic.js';
import { candidates, newCampaign, context, heatFloor } from '../campaign.js';
import { skip } from '../game.js';
import { owners } from '../fight.js';
import { canStand } from '../health.js';
import { isDeep } from '../legends.js';
import { waitingCar, letGo, waitingOf } from '../traffic.js';
import { sdr, crewFor, newTeam, pickUp, teamTick, teamSecond, glanced, FLAG_HEAT } from './sdr.js';

const TPS = 1000 / TICK_MS;
export const ARRIVE_S = 30, ARRIVE_M = 30, MEET_M = 4.5, SIT_S = 5, SIT_SKIP_S = 50, ANSWER_S = 2.5, SIGNAL_M = 25, FALLBACK_MIN = 45, FALLBACK_AWAY_S = 25;
export const WITH_M = 4, RIDE_WITH_M = 12, KEEP_M = 1.5, KNOWS_ME_S = 4, LOST_S = 60, LOST_M = 50, REACH_T_M = 2.2, GONE_S = 8;
export const FEAR0 = 50, FEAR_REST = 35, FEAR_EASE = 1.5, FEAR_CLOSE = 3, FEAR_UNIFORM = 1, UNIFORM_M = 12, FEAR_SIREN = 1.5, SIREN_M = 40, FAR_M = 12, FEAR_FAR = 1, FEAR_ALONE = 4, FEAR_SHOT = 30;
export const BOLT_FEAR = 95, BOLT_P = 1 / 60, BOLT_M = [50, 90], CAUGHT_FEAR = 55, STEADY_S = 180, SIGNAL_FEAR = 10;
export const CALM_S = 30, CALM_M = 4, CALM_DC = 11, CALM_WON = 25, CALM_LOST = 8, TEA_FEAR = 35;
export const SEE_M = 20, COP_SEE_M = 14, CLOSE_M = 8, FAR_LOOK_M = 12, LOOK_AGAIN_S = 90, OFF_SEE_M = 20, PHOTO_MOD = 2, BOLO_MOD = -4, CLOTHES_MOD = -3, KIT_K = 4, WATCHED_MOD = 2, WITH_MOD = -1;
export const FEAR_MODS = [[60, 1], [80, 2]];
export const POST_FROM_M = [18, 28], OUT_POST_M = [10, 16], POST_RADIO_S = 90, LOSE_S = 45, BACKUP_M = 45, CLOSE_AFTER_S = 150, CLOSE_ALONE_S = 60, FOLLOW_KEEP_M = 18, TRAIL_KEEP_M = 10, REPLAN_M = 2, TAKE_M = 2, TAKE_S = 20, LINK_M = 6, LINK_SEE_M = 15, FACE_M = 4, FACE_RAD = 1.75, SPOT_M = 30, DOWN_MIN = 5;
export const CHANGE_MIN = 5, KIT_MIN = 10, TEA_MIN = 20, ON_OTHER_K = 0.85, SAFE_REACH_M = 2.5, CAR_M = 3, LEAVE_S = 3, VAN_NERVE_M = 25, CIRCLE_S = 120;
export const SEARCH_ROWS = [2, 4], LEG_ROWS = [2, 5], ROWS_GROW_MIN = 12, LEG_M = 120, LEG_GROW_M = 5, RADIO_FRESH_MIN = 5, REINFORCE_MIN = 8, REINFORCE_MAX = 6, BOLO_GROW_MIN = 10;
export const TAXI_KNOWS = 0.15, RIDE_KNOWS = 0.08, KEPT_P = 0.5;
export const TIP_MIN = 18, TIP_M = 40, TIP_SEEN_M = 15, TIP_EMPTY = 0.3, EXPOSE_CLOTHES = 0.7, EXPOSE_K = { face: 0.7, kit: 0.4 };
const COATS = [[0x6b4636, 0x47302a], [0x2f6b62, 0x23252f], [0x8f6345, 0x6b4636], [0x4a2a52, 0x23252f], [0x4c5262, 0x23252f], [0x24503a, 0x14151c]];
const HATS = [{ kind: 'cap', color: 0x23252f }, { kind: 'beanie', color: 0x283f6b }, { kind: 'fedora', color: 0x353947 }, { kind: 'beanie', color: 0x6e2a2e }];

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const actorOf = (state, id) => state.actors.find(a => a.id === id);
const compOf = (state) => actorOf(state, state.scenario.comp);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const rowsText = (dr) => (dr === 0 ? 'on this street' : `${Math.abs(dr)} street${Math.abs(dr) > 1 ? 's' : ''} ${dr < 0 ? 'north' : 'south'}`);
const myRow = (state) => state.map.row ?? 0;
/** Whether a sees b: on the street in play, by the eye (sim/perception.js); off it, near on the same street (as followers reckon it). */
function sight(state, a, b) {
  if (!a || !b || b.hidden) return false;
  if (onMap(state, a) && onMap(state, b)) return seesActor(state, a, b);
  return rowOf(state, a) === rowOf(state, b) && Math.hypot(a.x - b.x, a.z - b.z) < OFF_SEE_M;
}
const distOf = (state, a, b) => (rowOf(state, a) === rowOf(state, b) ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
// (pronouns: whoever's brought out, and one of theirs, by their sheet)
const P = (state) => pron(state.people.comp?.sex);
const pron = (sex) => { const f = sex === 'f'; return { he: f ? 'she' : 'he', him: f ? 'her' : 'him', his: f ? 'her' : 'his', He: f ? 'She' : 'He', man: f ? 'woman' : 'man' }; };
const W_ = (state, a) => pron(state.people[a?.who]?.sex);
const nameOf = (state) => state.scenario.call;
const them_ = (state, a) => cap(describe(state.people[a.who].look, state.people[a.who].sex));
const dirOf = (from, to) => (to > from ? 'east' : 'west');

export const extraction = {
  name: 'An extraction',
  about: 'Bring someone of ours out before they\'re taken: the bench, a safe house, the city, the car.',
  police: true,                                                     // (the engine's patrols, its emergency services, its hunt: sim/game.js)

  brief(state) {
    const sc = state.scenario, B = sc.brief;
    return { title: B?.title ?? 'AN EXTRACTION', body: B?.body ?? [], footer: `${dateText(sc.began)} · ${clockText(sc.began)}`, keys: extraction.keys };
  },
  keys: [['instinct', 'meet, enter, hand over'], ['slow', 'their pace'], ['interact', 'hit the captor'], ['use', 'what\'s at hand'], ['watch', 'glance back']],

  setup(state, opts = {}) {
    let C = opts.campaign;
    if (!C) {                                                       // (on its own, ?play=extraction: a deep campaign made up for it, sim/kinetic.js debugMission(); a seed that tasks none, the next)
      let D = null;
      for (let k = 0; k < 30 && !D?.a; k++) D = debugMission({ seed: (state.seed ?? 7) + k, city: opts.city ?? 'moscow' }, (seed, city, level) => newCampaign(seed, candidates(seed, city, level)[0], city, level));
      state.campaign = D.campaign; state.assignment = D.a.id; C = context(D.campaign, D.a);
    }
    const r = state.rng, m = C.mission, cp = m.companion, campaign = state.campaign, P0 = campaign?.posting;
    state.time.ms = C.startMs;
    state.legend = P0 && isDeep(P0) ? { id: 'embassy', name: P0.job, cover: 'legend', alias: P0.alias, papers: P0.papers, floor: heatFloor(P0) } : { id: 'embassy', name: C.job ?? 'Your legend', cover: 'legend', floor: 0 };
    state.country = C.country;
    state.heat[heatKey('embassy', C.country)] = C.heat ?? 0;
    const me = { ...structuredClone(C.player), id: 'me' };
    state.people.me = me; state.player = 'me';
    const at = C.at, row = at.row;
    state.map = { kind: 'street', seed: C.mapSeed, row, i0: null, i1: null, crowd: 1, city: C.city };
    const mx = C.me?.x ?? at.x - 30, look = Math.sign(at.x - mx) || 1;
    state.actors.push({ id: 'a0', who: 'me', seed: null, row, x: mx, z: C.me?.z ?? -2.6, vx: 0, vz: 0, face: look > 0 ? 'right' : 'left', head: look > 0 ? 0 : Math.PI, gait: 'idle', stride: 0, stuck: 0, ai: null });
    // Whoever's to be brought out, on the way to the bench.
    state.people.comp = sheet({ id: 'comp', name: cp.codename ? `${cp.codename} (${cp.name})` : cp.name, sex: cp.sex, look: structuredClone(cp.look), persistent: true,
      skills: { deception: [cp.deception, 0], awareness: [cp.awareness, 0], fitness: [cp.fitness, 0], cqc: [3, 0], social: [6, 0] } });
    state.people.comp.age = cp.age;
    const seat = at.seats?.[0] ?? at.x, speed = Math.round(Math.max(1.05, Math.min(1.4, 1.4 - (cp.age - 30) * 0.006 + (cp.fitness - 8) * 0.008)) * 100) / 100;
    const comp = makeAgent(state, { who: 'comp', row, x: seat, z: at.z ?? 12.96, speed, face: 'down' });
    Object.assign(comp, { face: 'down', head: Math.PI / 2, gait: 'sit' });
    comp.ai.sit = true; comp.ai.role = 'comp'; comp.ai.noReach = true;   // (F never over them: sim/interact.js atHand())
    // (not there before the hour: they come along the path to it ARRIVE_S before, from out of sight, and sit)
    const arrive = C.meetFrom - ARRIVE_S * SEC > state.time.ms ? { at: C.meetFrom - ARRIVE_S * SEC, seat: { x: seat, z: at.z ?? 12.96 } } : null;
    if (arrive) { comp.hidden = true; comp.gait = 'idle'; comp.ai.sit = false; }
    const photo = { who: whoOf(state.people.comp), wear: wearOf(state.people.comp) };   // (the photograph they have, and the clothes they last saw)
    // Them: the searchers round where the companion was last known; the posts.
    const dir = chance(r, 0.5) ? 1 : -1;
    const anchor = { row: row + dir * (SEARCH_ROWS[0] + int(r, SEARCH_ROWS[1] - SEARCH_ROWS[0] + 1)), x: at.x + range(r, -100, 100) };
    const opp = {};
    for (let i = 0; i < (m.searchers ?? 3); i++) addSearcher(state, opp, C, m, anchor, i);
    const R = m.recce ?? {};
    if (m.posts?.pickup) {                                          // (a man who's been watching the asset: on a bench along the path, or a doorway across)
      const rr = stream('x-post', C.mapSeed, 'pickup'), who = officer(state, C, m, 0, 'postA', rr), off = range(rr, ...POST_FROM_M);
      const x = seat + (Math.abs(seat + off - mx) < 15 ? -1 : Math.abs(seat - off - mx) < 15 ? 1 : chance(rr, 0.5) ? 1 : -1) * off;   // (not on top of you as you come)
      const a = makeAgent(state, { who, row, x, z: chance(rr, 0.5) ? LINE.P : LINE.N, speed: 1.3 });
      Object.assign(a, { face: 'down', head: Math.atan2((at.z ?? 13) - a.z, seat - x) });
      a.ai.role = 'post';
      opp[a.id] = { kind: 'post', at: 'pickup', knows: state.time.ms, watching: true, looked: state.time.ms, close: false, seen: null, spotted: !!R.pickup?.post };
    }
    const O = m.out;
    if (m.posts?.out) {
      const rr = stream('x-post', C.mapSeed, 'out'), who = officer(state, C, m, 1, 'postB', rr), x = O.x + (chance(rr, 0.5) ? 1 : -1) * range(rr, ...OUT_POST_M);
      const a = makeAgent(state, { who, row: O.row, x, z: chance(rr, 0.5) ? LINE.N : LINE.F, speed: 1.3 });
      a.ai.role = 'post';
      opp[a.id] = { kind: 'post', at: 'out', knows: null, looked: 0, close: false, seen: null, spotted: !!R.out?.post };
    }
    state.people.driver = sheet({ id: 'driver', name: 'the driver', sex: 'm', look: { skin: 'light', hair: { style: 'short', color: 0x14151c }, hat: { kind: 'cap', color: 0x23252f }, top: { kind: 'coat', color: 0x23252f, trim: 0x14151c }, legs: 0x23252f, shoes: 0x14151c } });
    state.scenario = {
      kind: 'extraction', phase: 'wait', campaign: !!campaign, level: C.level ?? 'undercover', brief: C.brief, mission: m, at, out: O, houses: structuredClone(C.houses ?? []), comp: comp.id, call: callOf(m),
      opp, anchor, lastSeen: null, photo, arrive, fear: FEAR0, held: null, bolt: null, inside: null, calmAt: 0, driver: null, car: null, steadyUntil: 0,
      meetFrom: C.meetFrom ?? state.time.ms, waitUntil: C.meetTo ?? state.time.ms + 25 * MIN, dis: { clothes: false, kit: false, face: false }, used: [], linked: false, metAt: null, rideWith: false, inShop: false,
      seats: (at.seats ?? [seat]).map(x => ({ row, x })),          // (the bench kept for the two of you: nobody else sits on it, sim/acts.js seatTaken())
      fallback: null, signalled: false, reinforced: 0, prompt: null, outcome: null, began: state.time.ms, stats: { looks: 0, known: 0, takes: 0, fights: 0, bolts: 0, spotted: 0, calms: 0, rides: 0 },
      // (whoever was on you when you began it: on you still, being tailed's team, sim/scenarios/sdr.js)
      tail: C.team && C.team !== 'none' ? newTeam(state, C.team, crewFor(state, C.team, r), r) : null,
    };
    for (const [id, W] of Object.entries(opp)) if (W.kind === 'searcher') leg(state, actorOf(state, id));
    say(state, null, { kind: 'note', text: `${clockText(state.time.ms)}, ${streetName(townOf(state.map), row)}. ${nameOf(state)}'s bench from ${clockText(C.meetFrom)}; the car ${clockText(m.outFrom)}–${clockText(m.outUntil)}.` });
  },

  /** The team on you (if there is one) picks you up where you stand, as a meeting's does. */
  attach(state) {
    const sc = state.scenario;
    if (!sc.tail || sc.tail.started) return;
    sc.tail.started = true;
    pickUp(state);
  },

  /** In a safe house, or the car pulling away, the scene has your feet. */
  holds(state) { return !!state.scenario.inside || !!state.scenario.leaving; },

  /** Whoever's on you or on them, for the feel (sim/sense.js): the team's, and one of theirs who knows them that you don't know for theirs. */
  eyesOn(state) {
    const sc = state.scenario, mine = Object.entries(sc.opp).filter(([, W]) => W.knows && !W.watching && !W.spotted).map(([id]) => actorOf(state, id)).filter(Boolean);
    return [...(sc.tail ? sdr.eyesOn(state) : []), ...mine];
  },

  /** Keep the companion's stretch in play when they've bolted along it. */
  anchors(state) { const a = compOf(state); return a && rowOf(state, a) === myRow(state) ? [a.x] : []; },

  act(state, bus, action) {
    const sc = state.scenario, me = playerOf(state);
    if (!me || sc.outcome || sc.leaving) return;
    if (String(action).startsWith('desk:safe:')) return safeChoice(state, bus, me, action.slice(10));
    if (action === 'glance') { if (sc.tail && state.map.kind === 'street') glanced(state, bus, me); return; }   // (a look back, for the team on you: sim/scenarios/sdr.js)
    if (action !== 'instinct') return;
    // (T by where you are, whatever the line says over it: hunted.js's way, so a warning never takes the door from you)
    const comp = compOf(state), dC = comp ? distOf(state, me, comp) : Infinity, k = here(state, me);
    if (sc.inside) return safeCard(state, bus);                     // (the card again: what's here, or out: its last way)
    if (sc.phase === 'wait') {
      if (dC < MEET_M && !sc.arrive && !comp.hidden) return meet(state, bus, me, comp);
      if (signalOk(state, me, comp)) return signal(state, bus, comp);
      return say(state, bus, { kind: 'instinct', text: `${nameOf(state)}'s bench: ${farTo(state, me, sc.at)}.` });
    }
    if (sc.bolt) return dC <= REACH_T_M ? caughtUp(state, bus, comp) : say(state, bus, { kind: 'instinct', text: `Closer: ${Math.round(dC)} m.` });
    if (k.car) return handOver(state, bus, me, comp);
    if (k.house && (!sc.used.includes(k.house.id) || sc.prompt?.act !== 'calm')) return enterHouse(state, bus, me, comp, k.house.id);   // (in again, unless the line's a word for them)
    if (comp && dC <= CALM_M) return calm(state, bus, comp);
    say(state, bus, { kind: 'instinct', text: 'Nothing to do here but walk.' });
  },

  /** The bench's minute, sat (me.busy 'meet', sim/game.js): the clock on, and up together. */
  afterBusy(state, bus, what) {
    const sc = state.scenario;
    if (what !== 'meet' || sc.outcome) return;
    skip(state, bus, SIT_SKIP_S * SEC);
    for (const W of Object.values(sc.opp)) if (W.knows && W.seen) W.seen.ms = state.time.ms;   // (whoever had his eyes on the bench had them there all the minute)
    say(state, bus, { kind: 'note', text: 'A minute on the bench, the pigeons, nobody. Up, together.' });
  },

  think(state, a, bus) {
    const sc = state.scenario, role = a.ai?.role;
    if (a.ai?.kind === 'watcher') return sdr.think(state, a, bus); // (the team on you: being tailed's, sim/scenarios/sdr.js)
    if (sc.outcome) { if (role !== 'comp') { a.vx = a.vz = 0; } return; }
    if (role === 'comp') return compThink(state, a);
    if (role === 'driver' || (role === 'post' && !sc.opp[a.id]?.knows) || (role === 'post' && sc.opp[a.id]?.watching)) { if (!a.ai.route || a.ai.s >= a.ai.route.length - 0.05) { a.vx = a.vz = 0; a.gait = 'idle'; } return; }
    if (sc.opp[a.id]) oppThink(state, bus, a, sc.opp[a.id]);
  },

  tick(state, bus) {
    const sc = state.scenario, me = playerOf(state), now = state.time.ms, comp = compOf(state);
    if (sc.outcome || !me) return;
    if (sc.leaving) { if (now >= sc.leaving.at) end(state, bus, sc.leaving.outcome, sc.leaving.text); return; }
    if (state.people[state.player]?.dead) return end(state, bus, 'dead', 'The extraction ends here, with you.');
    if (state.campaign?.over && !sc.outcome) return end(state, bus, 'captured', `${nameOf(state)} is somewhere else in the same building. You won't see ${P(state).him} again.`);   // (taken, by the police's hunt or anyone's: sim/prison.js)
    if (state.people.comp?.dead) return end(state, bus, 'killed', `${nameOf(state)} is dead on the pavement. There's nobody to bring out any more.`);
    if (sc.inside) { sc.prompt = { id: 'inside', tone: 'calm', text: 'Inside. {instinct}: the card.', act: 'card', ms: now }; return; }
    // (the team on you, every tick; what they write down, heat at the end: sim/scenarios/sdr.js)
    if (sc.tail && state.map.kind === 'street' && teamTick(state, bus, me)) { teamSecond(state, bus, me); teamLink(state, bus, me, comp); }
    if (sc.arrive) arriveTick(state, now);
    if (sc.rideWith && !me.cab) ride(state, bus, 'off', 0, 'taxi');  // (a ride that never went, unpaid: out beside you again)
    if (sc.answer && now >= sc.answer.at) { speak(state, bus, comp?.id, sc.answer.text, sc.answer.aside); sc.answer = null; }
    if (sc.held) holdTick(state, bus, me, now);
    if (sc.held && now >= sc.held.until) return takenAway(state, bus);
    if (state.tick % TPS !== 0) return;
    // Once a second: the windows, the car, their eyes, yours, the fear.
    if (sc.phase === 'wait' && now > sc.waitUntil && !sc.arrive) return end(state, bus, 'missed', `${clockText(now)}: ${nameOf(state)} gets up from the bench, looks round once more, and walks away toward home. They'll be waiting there.`);
    if (sc.phase === 'with' && now > sc.mission.outUntil) return end(state, bus, 'stranded', `${clockText(sc.mission.outUntil)}, and the car pulls out without you, as its driver was told to. ${nameOf(state)} looks at you, and you have nothing to say.`);
    carTick(state, now);
    if (now - sc.began >= (sc.reinforced + 1) * REINFORCE_MIN * MIN && sc.reinforced < REINFORCE_MAX) { sc.reinforced++; addSearcher(state, sc.opp, null, sc.mission, sc.lastSeen && now - sc.lastSeen.ms < RADIO_FRESH_MIN * MIN ? sc.lastSeen : sc.anchor, 10 + sc.reinforced); }   // (more of them as the evening goes)
    if (comp && sc.phase === 'with') { fearTick(state, bus, me, comp, now); tip(state, bus, comp, now); }
    for (const [id, W] of Object.entries(sc.opp)) { const a = actorOf(state, id); if (a) eyes(state, bus, a, W, me, comp, now); }
    cops(state, bus, me, comp, now);
    spot(state, bus, me);
    if (comp && sc.phase === 'with' && !sc.held) apart(state, bus, me, comp, now);
    sc.prompt = settle(sc.prompt, [...instinct(state, me, comp, now)], now);
  },

  /** Into a shop with them beside you: they come in too; out by the back, both of you, and whoever had them waits at the front. */
  onShop(state, bus, phase, way) {
    const sc = state.scenario, me = playerOf(state), comp = compOf(state);
    if (sc.tail) sdr.onShop(state, bus, phase, way);
    if (sc.outcome || !comp || sc.phase !== 'with') return;
    if (phase === 'in') { if (distOf(state, me, comp) <= WITH_M && !sc.held) { sc.inShop = true; Object.assign(comp, { hidden: true, vx: 0, vz: 0 }); comp.ai.route = null; comp.ai.follow = null; } return; }
    if (!sc.inShop) return;
    sc.inShop = false;
    Object.assign(comp, { hidden: false, row: myRow(state), x: me.x + (me.x > comp.x ? -0.8 : 0.8), z: me.z, vx: 0, vz: 0 });
    comp.ai.route = null;
    if (way === 'back') for (const W of Object.values(sc.opp)) if (W.knows && !W.watching) { W.knows = null; W.lostAt = state.time.ms; }   // (out the back: whoever knew them waits at the front, for nothing)
  },

  /** A taxi that stopped for you: in, both of you, at the moment you get in, if they're beside you. */
  onBoard(state, bus, to, how) { ride(state, bus, 'on', TAXI_KNOWS, how); },
  /** A taxi's ride (sim/taxi.js): one hailed with no car stopped for you is decided now; out, beside you. */
  onTaxi(state, bus, to, phase) { if (state.scenario.tail) sdr.onTaxi(state, bus, to, phase); ride(state, bus, phase === 'out' ? 'off' : 'on', TAXI_KNOWS, 'taxi'); },
  onBus(state, bus, to, phase) { if (state.scenario.tail) sdr.onBus(state, bus, to, phase); ride(state, bus, phase === 'off' ? 'off' : 'on', RIDE_KNOWS, 'bus'); },
  onMetro(state, bus, to, phase) { if (state.scenario.tail) sdr.onMetro(state, bus, to, phase); ride(state, bus, phase === 'up' ? 'off' : 'on', RIDE_KNOWS, 'metro'); },
  onFelt(state, bus, a, roll, grade) { if (state.scenario.tail) sdr.onFelt(state, bus, a, roll, grade); },
  carry(state, way) { return state.scenario.tail ? sdr.carry(state, way) : []; },
  mapChanged(state) { if (state.scenario.tail) sdr.mapChanged(state); },
  destinations(state) {
    const sc = state.scenario, O = sc.out;
    return [{ id: 'out', label: 'a street near the car', row: O.row, x: O.x + (O.x > 40 ? -50 : 50) }, ...sc.houses.map(h => ({ id: h.id, label: h.label, row: h.row, x: h.x }))];
  },

  /** F on one of them: a blow, and he knows you; on the one who has them, the fight to get them back. */
  onInteract(state, bus, them, id) {
    const sc = state.scenario, W = sc.opp[them.id];
    if (sc.tail) sdr.onInteract(state, bus, them, id);
    if (sc.outcome || !W || id === 'read' || id === 'aid' || id === 'talk') return;
    if (state.fight && state.fight.b === them.who) state.fight.owner = 'extraction';   // (the fight's end is the scene's now, the street's hooks with it)
    if (sc.held?.by !== them.id) { link(state, bus, them); W.knows ??= state.time.ms; W.seen ??= { row: rowOf(state, them), x: them.x, z: them.z, ms: state.time.ms }; radio(state, them); }
  },

  /** A fight with one of them (sim/fight.js): won, he's down and they're free; lost, they have you both. */
  onExchange(state, bus, out) { owners.street?.onExchange?.(state, bus, out); },
  onFightEnd(state, bus, f) {
    owners.street?.onFightEnd?.(state, bus, f);                     // (the street's own: who saw it, who calls it in: sim/interact.js)
    const sc = state.scenario, a = state.actors.find(o => o.who === f.b), W = a && sc.opp[a.id];
    if (!W || sc.outcome) return;
    sc.stats.fights++;
    if (f.ended.by === 'a') {
      a.ai.downUntil = Math.max(a.ai.downUntil ?? 0, state.time.ms + DOWN_MIN * MIN); a.ai.route = null;
      if (sc.held?.by === a.id) { sc.held = null; sc.fear = Math.max(sc.fear, 85); say(state, bus, { kind: 'note', text: `${cap(W_(state, a).he)}'s down, and ${nameOf(state)}'s free. Go: now, not running.` }); }
      else say(state, bus, { kind: 'note', text: `${cap(W_(state, a).he)}'s down. The others will have heard: move.` });
      return;
    }
    const me = playerOf(state);
    caught(state, bus, me, [`Taken in the street walking ${nameOf(state)} to a car: there's no legend for that.`]);
    end(state, bus, 'captured', `Hands on you, a knee in your back, the cold of cuffs; and ${nameOf(state)} beside you on the pavement, not looking at you.`);
  },

  /** The places that matter on this street: them (over their head), the safe houses' doors, the car, the faces you know for theirs. */
  signs(state) {
    const sc = state.scenario, row = myRow(state), comp = compOf(state), out = [], Pr = P(state);
    if (sc.outcome) return out;
    if (comp && !comp.hidden && rowOf(state, comp) === row) {
      const known = Object.values(sc.opp).some(W => W.knows && !W.watching), d = distOf(state, playerOf(state), comp);
      out.push({ x: comp.x, z: comp.z, lift: 3.1, label: sc.call, sub: sc.held ? 'held' : sc.bolt ? 'running' : sc.phase === 'wait' ? 'waiting' : d > 6 ? `${Math.round(d)} m` : fearWord(sc.fear), kind: sc.held || known || sc.bolt ? 'tail' : sc.phase === 'with' ? 'safe' : 'seen', icon: 'eye' });
    }
    for (const [id, W] of Object.entries(sc.opp)) {
      const a = actorOf(state, id);
      if (!W.spotted || !a || a.hidden || rowOf(state, a) !== row || a.ai.downUntil > state.time.ms || sc.held?.by === id) continue;   // (the one holding them: theirs says so)
      out.push({ x: a.x, z: a.z, lift: 3.1, label: W.kind === 'cop' ? 'police' : W.kind === 'post' ? 'post' : 'watcher', sub: W.knows && !W.watching ? `has ${Pr.him}` : null, kind: 'tail', icon: 'eye' });
    }
    for (const h of sc.houses) if (h.row === row) out.push({ x: h.x, z: Z.front, label: 'safe house', kind: 'safe' });
    if (sc.out.row === row && !sc.leaving) out.push({ x: sc.out.x, z: sc.out.z, lift: 3.1, label: 'the car', sub: state.time.ms < sc.mission.outFrom ? `from ${clockText(sc.mission.outFrom)}` : null, kind: 'way', icon: 'pin' });
    return out;
  },

  /** Where you'd want to be: the bench; them, running; then the car. */
  goal(state) {
    const sc = state.scenario, me = playerOf(state), comp = compOf(state);
    if (sc.outcome || !me || sc.inside || sc.leaving) return null;
    const to = sc.bolt && comp ? { row: rowOf(state, comp), x: comp.x, z: comp.z, name: sc.call } : sc.phase === 'wait' ? { row: sc.at.row, x: sc.at.x, z: sc.at.z, name: 'the bench' } : { row: sc.out.row, x: sc.out.x, z: sc.out.z, name: 'the car' };
    const dr = to.row - myRow(state), far = dr ? rowsText(dr) : `${Math.round(Math.abs(to.x - me.x))} m`;
    return { row: to.row, x: to.x, z: to.z, name: to.name, far, kind: sc.bolt ? 'tail' : 'way', label: `${to.name} · ${far}` };
  },

  result(state) {
    const sc = state.scenario, s = sc.stats, who = sc.call, Pr = P(state);
    const stamp = { out: 'BROUGHT OUT', taken: 'TAKEN', captured: 'CAPTURED', killed: 'KILLED', dead: 'DEAD', bolted: 'LOST', lost: 'LOST', missed: 'MISSED', stranded: 'STRANDED' }[sc.outcome] ?? String(sc.outcome).toUpperCase();
    const dis = [sc.dis.clothes && 'other clothes', sc.dis.kit && 'a kit\'s disguise', sc.dis.face && 'a face of the disguise officer\'s'].filter(Boolean);
    return {
      stamp, good: sc.outcome === 'out', title: sc.brief?.title ?? `AN EXTRACTION: ${who.toUpperCase()}`, text: sc.endText,
      notes: [
        sc.metAt ? `Met at ${clockText(sc.metAt)}${sc.signalled ? ', at the fallback' : ''}; ${sc.used.length ? `by ${sc.used.length === 1 ? 'a safe house' : `${sc.used.length} safe houses`} on the way, ${dis.length ? `${dis.join(' and ')} for ${Pr.him}` : `nothing changed of ${Pr.him}`}` : `no safe house on the way${dis.length ? `, ${dis.join(' and ')}` : ''}`}.` : `You never sat down with ${Pr.him}.`,
        sc.tail ? (sc.tail.teamLost ? 'The team that was on you lost you on the way.' : 'The team that was on you was with you to the end.') : null,
        s.looks ? `They looked ${Pr.him} over ${times(s.looks)}${s.known ? `; ${s.known === 1 ? 'one' : s.known} of them knew ${Pr.him}` : `, and none of them knew ${Pr.him}`}${s.takes ? `; a hand on ${Pr.his} arm ${times(s.takes)}` : ''}${s.fights ? `; you fought ${s.fights === 1 ? 'one of them' : `${s.fights} of them`}` : ''}.` : `Nobody of theirs had a look at ${Pr.him}, as far as you know.`,
        s.spotted ? `You knew ${s.spotted === 1 ? 'one' : s.spotted} of their faces for theirs.` : null,
        sc.linked ? `They saw your face beside ${Pr.his}.` : `As far as you know, nobody saw your face beside ${Pr.his}.`,
      ].filter(Boolean),
      stats: [`${Math.round(((sc.ended ?? state.time.ms) - sc.began) / 60000)} min`, s.bolts && `${Pr.he} ran ${times(s.bolts)}`, s.calms && `${s.calms} word${s.calms === 1 ? '' : 's'} to steady ${Pr.him}`].filter(Boolean).join(' · '),
    };
  },
};

// ---------- them ----------

/** A sheet for one of theirs: a face of the city, the service's eyes and hands. */
function officer(state, C, m, i, kind, rr) {
  const K = cityById(C?.city ?? state.map.city ?? 'moscow'), sex = chance(rr, 0.2) ? 'f' : 'm', lk = K.people.look(rr, sex, 28 + int(rr, 20));
  delete lk.carry;
  if (!['coat', 'suit', ...(K.warm ? ['sweater', 'robe'] : [])].includes(lk.top?.kind)) lk.top = { kind: K.warm ? 'sweater' : 'coat', color: pick(rr, COATS)[0], trim: 0x23252f };   // (dressed for an evening's work outdoors)
  const who = `${kind}${i}`;
  state.people[who] = sheet({ id: who, name: `${describe(lk, sex)}`, sex, cls: 'spook', os: 30, look: lk,
    skills: { awareness: [9 + int(rr, 3) + Math.round((m.ci ?? 0.7) * 2), 1], tracking: [9, 1], cqc: [11 + int(rr, 4), 1], fitness: [9, 1], deception: [7 + int(rr, 3), 0] } });
  return who;
}
/** A searcher, about `around` (where the companion was last known, or seen), on his first leg (exported for the tests). */
export function addSearcher(state, opp, C, m, around, i) {
  const rr = stream('x-searcher', C?.mapSeed ?? state.map.seed, state.assignment ?? 'x', i), who = officer(state, C, m, i, 'searcher', rr);
  const a = makeAgent(state, { who, row: around.row + int(rr, 3) - 1, x: around.x + range(rr, -70, 70), z: chance(rr, 0.5) ? LINE.F : LINE.N, speed: range(rr, 1.25, 1.45), f: range(rr, -0.5, 0.5) });
  a.ai.role = 'searcher';
  opp[a.id] = { kind: 'searcher', knows: null, looked: 0, close: false, seen: null, spotted: false };
  if (state.scenario?.anchor) leg(state, a);                         // (set up already: a reinforcement, on its first leg at once)
  return a;
}

/** A searcher's next leg: where they were last seen, recently (the radio); else about where they were last known, wider as the time goes. */
function leg(state, a) {
  const sc = state.scenario, now = state.time.ms, r = stream('x-leg', state.map.seed, a.id, now);
  const fresh = sc.lastSeen && now - sc.lastSeen.ms < RADIO_FRESH_MIN * MIN, base = fresh ? sc.lastSeen : sc.anchor;
  const spread = fresh ? 30 : LEG_M + (now - sc.began) / MIN * LEG_GROW_M;
  const rows = fresh ? 1 : rowsOut(sc, now), row = base.row + int(r, 2 * rows + 1) - rows, x = base.x + range(r, -spread, spread);
  try { setRoute(state, a, routeFrom(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, { row, x, z: chance(r, 0.5) ? LINE.F : LINE.N })); a.ai.pace = fresh ? 1.15 : 1; a.ai.goal = null; } catch { a.ai.route = null; }
}

/**
 * One of theirs on his way somewhere (a man after them, closing in): a route there, planned again only when it's moved on
 * REPLAN_M from where the last one ended and a second's gone by, and never while he's waiting on a car, round one, or half
 * across a way between two lines (the planner would start him back at the nearest line: sim/city.js).
 */
function goto(state, a, to, pace = 1) {
  const ai = a.ai, now = state.time.ms;
  const done = !ai.route || ai.s >= ai.route.length - 0.05, moved = !ai.goal || ai.goal.row !== to.row || Math.hypot(ai.goal.x - to.x, ai.goal.z - to.z) > REPLAN_M;
  const across = !Object.values(LINE).some(z => Math.abs(a.z - z) < 0.9) && a.z > Z.front && a.z < Z.south;
  ai.pace = pace;
  if (!done && (!moved || now - (ai.planned ?? 0) < SEC || ai.carWait > 0 || ai.detour || across)) return;
  try { setRoute(state, a, routeFrom(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, to)); ai.goal = { ...to }; ai.planned = now; } catch { ai.route = null; }
}

/** How many streets either side of where they were last known the search reaches by now: LEG_ROWS, one more every ROWS_GROW_MIN. */
const rowsOut = (sc, now) => Math.min(LEG_ROWS[1], LEG_ROWS[0] + Math.floor((now - sc.began) / (ROWS_GROW_MIN * MIN)));

/** The radio: the others make for where they were seen. */
function radio(state, from, at = null) {
  const sc = state.scenario, comp = compOf(state);
  if (at) sc.lastSeen = { ...at, ms: state.time.ms };
  else if (comp) sc.lastSeen = { row: rowOf(state, comp), x: comp.x, ms: state.time.ms };
  for (const [id, W] of Object.entries(sc.opp)) { const a = actorOf(state, id); if (a && a !== from && W.kind === 'searcher' && !W.knows) leg(state, a); }
}

/** One of theirs, a second: searching, following, closing in, holding. */
function oppThink(state, bus, a, W) {
  const sc = state.scenario, comp = compOf(state), now = state.time.ms;
  if (!comp) return;
  if (sc.held?.by === a.id) { a.ai.route = null; a.vx = a.vz = 0; a.gait = 'idle'; a.head = Math.atan2(comp.z - a.z, comp.x - a.x); return; }
  if ((state.tick + hash(a.id)) % TPS !== 0) return;
  if (W.knows && !W.watching) {
    const sees = sight(state, a, comp) && !sc.inside && !sc.inShop;
    if (sees) W.seen = { row: rowOf(state, comp), x: comp.x, z: comp.z, ms: now };
    if (!W.seen || now - W.seen.ms > LOSE_S * SEC || a.ai.follow?.lost) return lost(state, a, W);
    const backup = Object.entries(sc.opp).some(([id, o]) => id !== a.id && o.knows && !o.watching && actorOf(state, id) && distOf(state, actorOf(state, id), comp) < BACKUP_M);
    const closing = a.cop || backup || now - W.knows > (W.kind === 'post' ? CLOSE_AFTER_S : CLOSE_ALONE_S) * SEC || W.close;
    if (!closing) {                                                 // (following: the engine's follower, sim/agents.js: their trail, through a lane, on a shop's door; well back)
      if (a.ai.follow?.id !== comp.id) { follow(state, a, comp, W.kind === 'post' ? FOLLOW_KEEP_M : TRAIL_KEEP_M); a.ai.pace = 1.1; }
      return;
    }
    a.ai.follow = null;
    const d = distOf(state, a, comp);
    if (sees && d <= TAKE_M && !sc.held && !state.fight && !comp.hidden) return take(state, bus, a, W);
    // (closing: to where they'll be in a second, not where they were)
    goto(state, a, sees ? { row: rowOf(state, comp), x: comp.x + comp.vx, z: comp.z + comp.vz } : W.seen, 1.35);
    W.close = true;
    return;
  }
  if (a.cop) return;                                                // (an officer who doesn't know them: the engine's patrol)
  if (W.kind === 'post') return;
  if (!a.ai.route || a.ai.s >= a.ai.route.length - 0.05) leg(state, a);
}
/** One of theirs who's lost them: a searcher back to looking; an officer the patrol's again, on along his pavement (sim/police.js). */
function lost(state, a, W) {
  W.knows = null; W.lostAt = state.time.ms; W.close = false; W.radioAt = null; a.ai.follow = null;
  if (a.cop) {
    delete a.scene;
    try { setRoute(state, a, routeFrom(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, { row: rowOf(state, a), x: a.x + (chance(state.rng, 0.5) ? 80 : -80), z: a.z })); a.ai.pace = 1; } catch { a.ai.route = null; }
    return;
  }
  if (W.kind === 'searcher') leg(state, a);
}

/** Hold of them: TAKE_S of it; within reach of him, the moment's yours. */
function take(state, bus, a, W) {
  const sc = state.scenario, comp = compOf(state), me = playerOf(state), Pr = P(state);
  sc.held = { by: a.id, since: state.time.ms, until: state.time.ms + TAKE_S * SEC, offered: false };
  sc.stats.takes++;
  sc.fear = 100;
  sc.bolt = null;
  comp.ai.route = null; comp.ai.follow = null; comp.vx = comp.vz = 0;
  a.ai.route = null;
  if (me) sc.prompt = settle(null, [...instinct(state, me, comp, state.time.ms)], state.time.ms);   // (the line says so at once: a fight's choice may stop the clock before the next second)
  const words = a.cop ? `"Documents." An officer's hand on ${nameOf(state)}'s sleeve, the other on ${W_(state, a).his} radio.` : `A hand on ${nameOf(state)}'s arm, a word in ${Pr.his} ear, and ${Pr.he} goes still: "Come with us, quietly."`;
  say(state, bus, { kind: 'note', text: words });
  if (me && linkable(state, a, me, comp)) link(state, bus, a);
  holdTick(state, bus, me, state.time.ms);
}

/** While they're held: the one holding them down (a blow, a shot), and they're free; in a fight with you, the clock waits; within reach of him, the moment. */
function holdTick(state, bus, me, now) {
  const sc = state.scenario, a = actorOf(state, sc.held.by), p = a && state.people[a.who];
  if (!a || !p || p.dead || !canStand(p) || a.ai.downUntil > now) { sc.held = null; sc.fear = Math.max(sc.fear, 85); return say(state, bus, { kind: 'note', text: `${nameOf(state)}'s free. Go: now, not running.` }); }
  if (state.fight?.b === a.who) sc.held.until = Math.max(sc.held.until, now + 3 * SEC);
  // (the moment, seen: time stops for it once you're within reach of him; from further off, closing is yours to do)
  if (!sc.held.offered && me && !state.fight && distOf(state, me, a) <= REACH_T_M + 0.5) {
    sc.held.offered = true;
    offer(state, bus, { why: 'held', who: a.id, x: a.x, title: `${them_(state, a)} has ${nameOf(state)}`, text: `Go in at ${W_(state, a).him}, or walk on.`,
      options: [{ key: 'go', label: `Go in at ${W_(state, a).him}`, do: 'edge' }], none: 'Walk on', fight: { style: 'even', owner: 'extraction', line: `You're on ${W_(state, a).him} before ${W_(state, a).he}'s turned: ${nameOf(state)}'s arm out of ${W_(state, a).his} hand.` } });
  }
}

/** The hold's time up: they take them. */
function takenAway(state, bus) {
  const sc = state.scenario, a = actorOf(state, sc.held.by), comp = compOf(state), me = playerOf(state), Pr = P(state);
  if (me && comp && a && linkable(state, a, me, comp)) link(state, bus, a);
  end(state, bus, 'taken', a?.cop ? `The radio crackles, a car with its lights going pulls in, and ${nameOf(state)} is in the back of it with ${Pr.his} head pushed down. ${Pr.He} doesn't look for you.` : `A car without markings at the kerb, a door, a hand on ${Pr.his} head, and ${nameOf(state)}'s gone. ${Pr.He} didn't look for you, which was the last thing ${Pr.he} could do for you.`);
}

/**
 * Whether one of theirs who knows them has a good look at you beside them: you within LINK_M of them, him within LINK_SEE_M of
 * you, in his sight, and your face to him (a man walking behind you has your back: within FACE_M, or ahead of you, FACE_RAD of
 * where you're looking; a look back over your shoulder shows it him).
 */
const linkable = (state, a, me, comp) => !!me && distOf(state, me, comp) <= LINK_M && distOf(state, a, me) <= LINK_SEE_M && sight(state, a, me) && faceTo(a, me);
function faceTo(a, me) {
  if (Math.hypot(a.x - me.x, a.z - me.z) <= FACE_M) return true;
  const to = Math.atan2(a.z - me.z, a.x - me.x), off = Math.abs(((to - (me.head ?? 0) + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  return off < FACE_RAD;
}

/** Your face beside theirs, in the eyes of one who knows them (a: his actor; or who: the words for one who isn't on the street). */
function link(state, bus, a, who = null) {
  const sc = state.scenario, me = playerOf(state);
  if (sc.linked) return;
  sc.linked = true;
  say(state, bus, { kind: 'note', hidden: true, text: `${a ? them_(state, a) : cap(who ?? 'someone')} had a good look at you beside ${nameOf(state)}.` });
  // (and your description goes out: the engine's hunt for whoever was with them, its units on the streets round it, sim/hunt.js)
  if (me) startHunt(state, bus, { why: 'exfil', row: myRow(state), x: me.x, who: true, wearing: true });
}

/** The team on you (a second): one of them with you in sight and them beside you, at the bench or after: your face and theirs, called in. */
function teamLink(state, bus, me, comp) {
  const sc = state.scenario, t = sc.tail;
  if (!t || t.teamLost || !comp || comp.hidden || sc.linked || (sc.phase !== 'with' && !me.busy)) return;
  if (distOf(state, me, comp) > LINK_M) return;
  const a = t.crew.map(c => actorOf(state, c.id)).find(x => x && distOf(state, x, me) < 30 && seesActor(state, x, me));
  if (!a) return;
  link(state, bus, a);
  radio(state, null);                                                // (and the face beside yours is the one on every clipboard: where it is, now)
}

/**
 * A look at them, by one of theirs (a second): in sight within reach, once, again LOOK_AGAIN_S on or once closer; known,
 * the radio. And whoever knows them, seeing you beside them, has your face too.
 */
function eyes(state, bus, a, W, me, comp, now) {
  const sc = state.scenario;
  if (!comp || comp.hidden || sc.phase === 'done' || a.ai.downUntil > now) return;
  const d = distOf(state, a, comp);
  if (W.knows) {
    if (W.watching && sight(state, a, comp)) W.seen = { row: rowOf(state, comp), x: comp.x, z: comp.z, ms: now };   // (the bench's post, watching: his eyes on them)
    if (me && linkable(state, a, me, comp) && (sc.phase === 'with' || me.busy?.what === 'meet')) link(state, bus, a);
    if (W.watching && sc.phase === 'with' && me?.busy?.what !== 'meet') { W.watching = false; W.knows = now; W.seen = { row: rowOf(state, comp), x: comp.x, z: comp.z, ms: now }; W.radioAt = now + POST_RADIO_S * SEC; }   // (they've got up with someone: he's after them, and lets them walk to see where before he calls it in)
    if (W.radioAt && now >= W.radioAt) { W.radioAt = null; radio(state, a); }
    return;
  }
  const reach = a.cop ? COP_SEE_M : SEE_M;
  if (d > reach || !sight(state, a, comp)) return;
  // (a look, and another LOOK_AGAIN_S on; a closer one if the first was from across the street; a patrol's pair look as one)
  const again = now - (W.looked ?? 0) > LOOK_AGAIN_S * SEC, closer = d <= CLOSE_M && !W.closeLook && (W.lookD ?? 0) > FAR_LOOK_M;
  if (!again && !closer) return;
  W.looked = now; W.lookD = d; if (d <= CLOSE_M) W.closeLook = true;
  if (a.cop && a.squad) for (const [id2, W2] of Object.entries(sc.opp)) if (W2.kind === 'cop' && actorOf(state, id2)?.squad === a.squad) Object.assign(W2, { looked: now, lookD: d, closeLook: W.closeLook });
  sc.stats.looks++;
  const roll = recognise(state, a, W, comp, me, d);
  say(state, bus, { kind: 'roll', roll, hidden: !W.spotted, text: roll.ok ? `${them_(state, a)} looks at ${nameOf(state)}, and looks again: ${W_(state, a).he} knows ${P(state).him}.` : `${them_(state, a)} looks ${nameOf(state)} over, and looks away.` });
  if (!roll.ok) return;
  W.knows = now; W.seen = { row: rowOf(state, comp), x: comp.x, z: comp.z, ms: now }; W.close = false;
  sc.stats.known++;
  if (a.cop) { a.scene = 'extraction'; a.ai.route = null; }         // (an officer of the engine's patrol, on it now: sim/police.js keeps him; lost(), his again)
  if (W.spotted) strain(state, bus, 8);                             // (one you know for theirs, and you see it in his face: sim/needs.js)
  radio(state, a);
  if (me && linkable(state, a, me, comp)) link(state, bus, a);
}

/** Their Awareness against the companion's Deception, with everything that's on either side (exported for the tests' odds). */
export function recognise(state, a, W, comp, me, d) {
  const sc = state.scenario, p = state.people[a.who], cp = state.people.comp, A = advancedOf(cp), through = A ? readThrough(state.rng, p, cp) : null;
  const crowd = state.actors.filter(o => o !== comp && o !== a && o !== me && !o.hidden && distOf(state, o, comp) < 4).length;
  const light = lightBand(lightHere(state, comp.x, comp.z)), fearV = FEAR_MODS.reduce((v, [f, k]) => (sc.fear >= f ? k : v), 0);
  const mods = [
    a.cop ? bolo(state) : W.kind === 'post' && W.at === 'pickup' ? { why: 'watching for exactly this face', v: PHOTO_MOD + 2 } : W.kind === 'post' ? { why: 'posted, and reading every face', v: PHOTO_MOD + 2 } : { why: 'the photograph in the pocket', v: PHOTO_MOD },
    sc.mission.companion.kind === 'colleague' && { why: 'a face they\'ve had under watch for months', v: WATCHED_MOD },
    wearOf(cp) !== sc.photo.wear && { why: 'other clothes than the photograph\'s', v: CLOTHES_MOD },
    cp.disguise && !A && { why: 'a disguise', v: -Math.round(cp.disguise.q * KIT_K) },
    A && (through?.through ? { why: 'a face that isn\'t right', v: -ADV_SEEN } : { why: 'another face', v: -Math.round(ADV_MOD * A.q) }),   // (their side of it: read through, a reason to look harder)
    light === 'dark' && { why: 'the dark', v: -3 }, light === 'dim' && { why: 'the dusk', v: -1 },
    crowd && { why: 'people round them', v: -Math.min(4, crowd) }, d > 10 && { why: 'at a distance', v: -Math.round((d - 10) / 3) },
    sc.bolt && { why: 'running', v: 6 }, !sc.bolt && (comp.ai.pace ?? 1) > 1.1 && comp.ai.route && { why: 'hurrying', v: 2 },
    fearV && { why: 'a frightened face', v: fearV },
    me && sc.phase === 'with' && distOf(state, me, comp) < 2.5 && { why: 'walking with someone: a couple isn\'t the description', v: WITH_MOD },
    ...weatherMods(state),
  ].filter(Boolean);
  return opposed(state.rng, { skill: 'awareness', value: skill(p, 'awareness'), body: p, mods }, { skill: 'deception', value: skill(cp, 'deception'), body: cp }, { them: true });
}

/** A patrol officer's photograph: one of twenty from the shift change (BOLO_MOD), better known every BOLO_GROW_MIN as it goes round. */
function bolo(state) {
  const k = Math.min(-BOLO_MOD - 1, Math.floor((state.time.ms - state.scenario.began) / (BOLO_GROW_MIN * MIN)));
  return k > 0 ? { why: 'the photograph, at every briefing by now', v: BOLO_MOD + k } : { why: 'one photograph of twenty from the shift change', v: BOLO_MOD };
}

/**
 * A face from the evening news, phoned in (a second): with them in the open, one in TIP_MIN minutes on average, by how much
 * they look like the photograph (exposure()) and whether there's anyone about to see them; the searchers make for where they
 * were (within TIP_M). Time in the street costs; another coat and another face buy it back; a safe house stops it.
 */
function tip(state, bus, comp, now) {
  const sc = state.scenario;
  if (comp.hidden || state.map.kind !== 'street') return;
  const about = state.actors.some(o => o !== comp && !o.hidden && isPasser(o) && distOf(state, o, comp) < TIP_SEEN_M);
  if (!chance(state.rng, exposure(state) * (about ? 1 : TIP_EMPTY) / (TIP_MIN * 60))) return;
  const r = stream('x-tip', state.map.seed, now);
  sc.stats.tips = (sc.stats.tips ?? 0) + 1;
  radio(state, null, { row: rowOf(state, comp), x: comp.x + range(r, -TIP_M, TIP_M) });
  say(state, bus, { kind: 'note', hidden: true, text: `${clockText(now)}: someone phoned in a face from the news, ${streetName(townOf(state.map), rowOf(state, comp))}.` });
}
const isPasser = (o) => o.ai && !o.ai.role && !o.cop && o.who !== 'me';
/** How much like the photograph they look: 1 as they are; less in other clothes (EXPOSE_CLOTHES), another face, a kit's hair and glasses (EXPOSE_K × its quality). */
export function exposure(state) {
  const sc = state.scenario, cp = state.people.comp, A = advancedOf(cp), k = A ? EXPOSE_K.face * A.q : cp.disguise ? EXPOSE_K.kit * cp.disguise.q : 0;
  return (wearOf(cp) !== sc.photo.wear ? EXPOSE_CLOTHES : 1) * (1 - k);
}

/** The engine's patrols (sim/police.js), each with the photograph: a look, as theirs (an officer's own entry in sc.opp). */
function cops(state, bus, me, comp, now) {
  const sc = state.scenario;
  for (const a of state.actors) if (a.cop && !a.guard && !sc.opp[a.id]) sc.opp[a.id] = { kind: 'cop', knows: null, looked: 0, close: false, seen: null, spotted: true };   // (a uniform: anyone knows it for theirs)
  for (const id of Object.keys(sc.opp)) if (sc.opp[id].kind === 'cop' && !actorOf(state, id)) delete sc.opp[id];
}

/** Your eyes on theirs: one in your view within SPOT_M, once, your Awareness against his Deception. */
function spot(state, bus, me) {
  const sc = state.scenario, p = state.people[state.player];
  for (const [id, W] of Object.entries(sc.opp)) {
    if (W.spotted || W.tried) continue;
    const a = actorOf(state, id);
    if (!a || a.hidden || !onMap(state, a) || !inView(state, id) || Math.hypot(a.x - me.x, a.z - me.z) > SPOT_M) continue;
    W.tried = true;
    const them = state.people[a.who];
    const roll = opposed(state.rng, { skill: 'awareness', value: skill(p, 'awareness'), body: p, mods: [W.kind === 'post' && { why: 'nowhere to be, and staying there', v: 2 }].filter(Boolean) }, { skill: 'deception', value: skill(them, 'deception'), body: them });
    if (!roll.ok) continue;
    W.spotted = true; sc.stats.spotted++;
    say(state, bus, { kind: 'roll', roll, text: W.kind === 'post' ? `${them_(state, a)}, standing about with nowhere to be: theirs.` : `${them_(state, a)}, looking at faces, not shops: theirs.` });
  }
}

/** Whoever's to be brought out, coming to the bench: from out of sight along the path (the side away from you), then sat on it. */
function arriveTick(state, now) {
  const sc = state.scenario, A = sc.arrive, comp = compOf(state), me = playerOf(state);
  if (!comp || !me || now < A.at) return;
  if (!A.walking) {
    const side = sc.at.row !== myRow(state) ? 1 : Math.sign(A.seat.x - me.x) || 1, x0 = A.seat.x + side * ARRIVE_M;
    Object.assign(comp, { hidden: false, row: sc.at.row, x: x0, z: LINE.P, face: side > 0 ? 'left' : 'right' });
    sc.away = null;
    try { setRoute(state, comp, routeFrom(townOf(state.map), { row: sc.at.row, x: x0, z: LINE.P }, { row: sc.at.row, x: A.seat.x, z: LINE.P })); } catch {}
    A.walking = true; return;
  }
  const ai = comp.ai;
  if (ai.route && ai.s < ai.route.length - 0.05 && Math.abs(comp.x - A.seat.x) > 0.3) return;
  Object.assign(comp, { x: A.seat.x, z: A.seat.z, face: 'down', head: Math.PI / 2, gait: 'sit', vx: 0, vz: 0 });
  ai.route = null; ai.sit = true; sc.arrive = null;
}

/**
 * The car (sim/traffic.js waitingCar()): on its street, in its hours, pulled in at the south kerb and held there, its driver
 * on the pavement by its back door; first seen arriving, along the lane; gone at its last minute.
 */
function carTick(state, now) {
  const sc = state.scenario, O = sc.out, m = sc.mission, onRow = myRow(state) === O.row;
  if (now >= m.outFrom && now < m.outUntil) {
    // (the Center's van won't stop with one of theirs by it: round the block, CIRCLE_S, and back if the window's still open)
    const nerve = sc.level === 'illegal' && Object.keys(sc.opp).some(id => { const a = actorOf(state, id); return a && !a.hidden && !(a.ai.downUntil > now) && rowOf(state, a) === O.row && Math.hypot(a.x - O.x, a.z - O.z) < VAN_NERVE_M; });
    if (nerve && !sc.circling) { sc.circling = now + CIRCLE_S * SEC; sc.stats.circled = (sc.stats.circled ?? 0) + 1; if (sc.car) letGo(state, sc.car); sc.car = null; sc.carCame = false; if (sc.driver) { state.actors = state.actors.filter(x => x.id !== sc.driver); sc.driver = null; } }
    if (sc.circling && now < sc.circling) return;
    sc.circling = null;
    if (onRow && !waitingOf(state, sc.car)) { const c = waitingCar(state, O.x, { arrive: !sc.carCame }); if (c) { sc.car = c.id; sc.carCame = true; } }
    const car = onRow && waitingOf(state, sc.car);
    if (!sc.driver && (!car || car.taxi?.stopped)) {                 // (out of it once it's pulled in)
      const a = { id: `a${state.nextActor++}`, who: 'driver', seed: null, row: O.row, x: O.x - 1.2, z: O.z, vx: 0, vz: 0, face: 'up', head: -Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: { kind: 'agent', role: 'driver', route: null, s: 0, stop: 0, wait: 0, speed: 1.2, f: 0, f0: 0 } };
      state.actors.push(a); sc.driver = a.id;
    }
  }
  if (now >= m.outUntil) { if (sc.car) letGo(state, sc.car); sc.car = null; if (sc.driver) { state.actors = state.actors.filter(x => x.id !== sc.driver); sc.driver = null; } }
}

// ---------- them, brought out ----------

/**
 * The companion, a tick: on the bench (sat while you sit beside them); at your heel (the engine's follower, in your footsteps,
 * sim/agents.js follow() with heel: across the road where you crossed, up the lane you took, hurrying when they're far or
 * have lost sight of you; lost, stood where they last saw you, and at your heel again once you're in their sight); running;
 * held; inside; gone home the long way to the fallback.
 */
function compThink(state, a) {
  const sc = state.scenario, me = playerOf(state), ai = a.ai;
  if (sc.phase === 'wait' && (sc.arrive || sc.away)) {             // (on the way to the bench: arriveTick(); waved off, out of sight, and whoever went after them with them)
    if (sc.away && state.time.ms >= sc.away.hideAt && !a.hidden) { a.hidden = true; ai.route = null; a.row = sc.at.row; state.actors = state.actors.filter(x => x.ai?.role !== 'gone'); }
    return;
  }
  if (me?.busy?.what === 'meet') { ai.follow = null; ai.route = null; a.vx = a.vz = 0; a.gait = 'sit'; return; }   // (the minute on the bench)
  if (!me || sc.held || sc.inside || sc.inShop || (sc.rideWith && a.hidden) || sc.phase === 'wait') { ai.follow = null; ai.route = null; a.vx = a.vz = 0; if (sc.phase === 'wait') a.gait = 'sit'; return; }
  if (sc.bolt) {                                                    // (running: to the end of the way they chose, then stood, shaking)
    ai.follow = null;
    if (!ai.route || ai.s >= ai.route.length - 0.05) { ai.route = null; ai.pace = 1; a.gait = 'idle'; }
    return;
  }
  if (!ai.follow || (ai.follow.lost && sight(state, a, me))) { follow(state, a, me, KEEP_M, { heel: true }); ai.sit = false; ai.f = 0; }
  if (ai.follow.lost) { ai.route = null; a.vx = a.vz = 0; a.gait = 'idle'; }
}
/** Whether they know where you are: their follower's eyes on you lately (sim/agents.js). */
const knowsMe = (state, comp) => { const fo = comp?.ai?.follow; return !!fo && !fo.lost && state.time.ms - fo.seenMs < KNOWS_ME_S * SEC; };

/** Their fear, a second: by what they can see and hear; beside you they settle; and a bolt when it's past bearing, rarely. */
function fearTick(state, bus, me, comp, now) {
  const sc = state.scenario, Pr = P(state);
  if (sc.held) { sc.fear = 100; return; }
  if (comp.hidden || me.busy?.what === 'meet') { sc.fear = Math.max(FEAR_REST, sc.fear - FEAR_EASE); return; }   // (in a shop, a cab, a carriage with you, on the bench beside you: beside you)
  let up = 0, row = rowOf(state, comp);
  for (const [id, W] of Object.entries(sc.opp)) {
    const a = actorOf(state, id);
    if (!a || a.hidden || a.ai.downUntil > now) continue;
    const d = distOf(state, a, comp);
    if (W.knows && !W.watching && W.close && d < 15 && sight(state, comp, a)) up += FEAR_CLOSE;   // (one of them coming at them: they see it; a man following well back, an amateur doesn't)
    else if (a.cop && d < UNIFORM_M && sight(state, comp, a)) up += FEAR_UNIFORM;                // (a uniform, close)
  }
  if ((state.traffic?.cars ?? []).some(c => c.ems?.lights && (state.traffic.row ?? myRow(state)) === row && Math.abs(c.x - comp.x) < SIREN_M)) up += FEAR_SIREN;   // (a police car's lights in the street)
  const dMe = distOf(state, me, comp), seesMe = knowsMe(state, comp);
  if (!seesMe) up += FEAR_ALONE; else if (dMe > FAR_M) up += FEAR_FAR;
  if (state.$shotBy && now - state.$shotBy.ms < 1500 && sc.shotAt !== state.$shotBy.ms) { sc.shotAt = state.$shotBy.ms; up += FEAR_SHOT; }
  const steady = now < sc.steadyUntil;
  let f = sc.fear + (steady ? up / 2 : up);
  if (seesMe && dMe < 6 && f > FEAR_REST) f = Math.max(FEAR_REST, f - FEAR_EASE);   // (walking beside you: they settle, whatever's out there they can't see)
  sc.fear = Math.max(0, Math.min(100, f));
  if (sc.bolt || steady || sc.fear < BOLT_FEAR) return;
  if (!chance(state.rng, (sc.fear - BOLT_FEAR + 3) * BOLT_P)) return;
  // (off at a run, away from whatever's nearest that frightens them, or from you)
  const threat = Object.keys(sc.opp).map(id => actorOf(state, id)).filter(a => a && rowOf(state, a) === rowOf(state, comp)).sort((x, y) => distOf(state, x, comp) - distOf(state, y, comp))[0] ?? me;
  const away = Math.sign(comp.x - threat.x) || 1, r = stream('x-bolt', state.map.seed, now);
  try { setRoute(state, comp, routeFrom(townOf(state.map), { row: rowOf(state, comp), x: comp.x, z: comp.z }, { row: rowOf(state, comp) + (chance(r, 0.4) ? (chance(r, 0.5) ? 1 : -1) : 0), x: comp.x + away * range(r, ...BOLT_M), z: chance(r, 0.5) ? LINE.F : LINE.N })); } catch { return; }
  comp.ai.pace = 2.2; comp.ai.sit = false; comp.ai.follow = null;
  sc.bolt = { since: now }; sc.stats.bolts++;
  say(state, bus, { kind: 'note', text: `${nameOf(state)} breaks: off at a run, ${dirOf(comp.x, comp.x + away)}, people turning to look. After ${Pr.him}, and don't shout.` });
}

/** You and them apart: out of each other's sight too long, too far, and you've lost each other. */
function apart(state, bus, me, comp, now) {
  const sc = state.scenario, Pr = P(state);
  const together = comp.hidden || sight(state, me, comp) || knowsMe(state, comp) || distOf(state, me, comp) < WITH_M;
  if (together) { sc.apartSince = null; return; }
  sc.apartSince ??= now;
  if (now - sc.apartSince < LOST_S * SEC || distOf(state, me, comp) < LOST_M) return;
  end(state, bus, sc.bolt ? 'bolted' : 'lost', sc.bolt ? `Somewhere in the streets behind you ${nameOf(state)} is still running, alone, with ${Pr.his} face on every patrol's clipboard. You won't find ${Pr.him} now; they will.` : `You've lost ${Pr.him}: ${nameOf(state)} is somewhere back there, alone, standing where ${Pr.he} last saw you. They'll find ${Pr.him} before you do.`);
}

// ---------- what you do ----------

/** T by them on the bench: the word (an asset), the parole (a colleague, and their answer); a minute sat; and they're with you. */
function meet(state, bus, me, comp) {
  const sc = state.scenario, cp = sc.mission.companion, Pr = P(state), at = sc.at;
  if (!comp || sc.phase !== 'wait' || sc.arrive) return;
  sc.phase = 'with'; sc.metAt = state.time.ms;
  comp.ai.sit = false;
  // (sat beside them a minute, as anyone on a bench: then up together; walk off sooner and they come at once)
  const seat = at.seats?.find(x => Math.abs(x - comp.x) > 1) ?? comp.x + 1.6;
  me.busy = { what: 'meet', steps: [['go', seat, (at.z ?? 12.96) + 0.4], ['go', seat, at.z ?? 12.96], ['wait', SIT_S * TPS, 'down', 'sit']], wait: 0, since: state.time.ms, done: 'scene:meet' };
  if (cp.knows) speak(state, bus, me.id, `You sit down at the other end of the bench. A minute; then, to the pigeons: "Now. Walk with me, slowly." ${nameOf(state)} folds ${Pr.his} paper, and gets up when you do.`, 'You: "Now. Walk with me, slowly."');
  else {                                                            // (the parole yours, the answer theirs a moment on: a balloon each, both lines in the log)
    speak(state, bus, me.id, `"${cp.parole[0]}"`, `You: "${cp.parole[0]}"`);
    sc.answer = { at: state.time.ms + ANSWER_S * SEC, text: `A long look. "${cp.parole[1]}" ${cap(Pr.he)}'ll get up when you do, and keep a pace behind.`, aside: `${nameOf(state)}: "${cp.parole[1]}"` };
  }
}

/** Whether the danger signal's yours to give: the bench's, before the meeting, with a reason you know of, near enough to be seen. */
function signalOk(state, me, comp) {
  const sc = state.scenario;
  if (sc.signalled || sc.phase !== 'wait' || sc.arrive || !comp || comp.hidden) return false;
  const d = distOf(state, me, comp);
  if (d < MEET_M || d > SIGNAL_M || me.hidden) return false;      // (they're watching for you: a hand to your hat, in the open, within SIGNAL_M, they see)
  const post = Object.values(sc.opp).some(W => W.kind === 'post' && W.at === 'pickup' && W.spotted), tail = sc.tail && !sc.tail.teamLost && Object.values(sc.tail.suspects ?? {}).some(v => v >= 2);
  return post || tail;
}

/**
 * The danger signal (a hand to your hat, across the path): they get up and go home the long way, and the fallback is another
 * bench FALLBACK_MIN on (fallbackPlace()), the car's hours with it. A man watching them goes after them; a team on you stays.
 */
function signal(state, bus, comp) {
  const sc = state.scenario, Pr = P(state), m = sc.mission, now = state.time.ms, fb = fallbackPlace(state);
  if (!fb) return say(state, bus, { kind: 'instinct', text: 'No fallback to send them to. Sit down, or walk on.' });
  sc.signalled = true; sc.prompt = null;
  const from = now + FALLBACK_MIN * MIN, shift = from - sc.meetFrom;
  // (they go: off along the path, then out of sight, and the man watching them after them, out of the evening)
  try { setRoute(state, comp, routeFrom(townOf(state.map), { row: rowOf(state, comp), x: comp.x, z: comp.z }, { row: rowOf(state, comp), x: comp.x + (comp.x > sc.at.x ? 40 : -40), z: LINE.P })); } catch {}
  comp.ai.sit = false; comp.ai.pace = 1;
  sc.away = { hideAt: now + FALLBACK_AWAY_S * SEC };
  for (const [id, W] of Object.entries(sc.opp)) {
    if (W.kind !== 'post' || W.at !== 'pickup') continue;
    const a = actorOf(state, id);
    if (a) { try { setRoute(state, a, routeFrom(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, { row: rowOf(state, a), x: comp.x + (comp.x > sc.at.x ? 60 : -60), z: LINE.P })); } catch {} a.ai.role = 'gone'; }
    delete sc.opp[id];
  }
  sc.at = fb; sc.meetFrom = from; sc.waitUntil = from + 25 * MIN; sc.seats = fb.seats.map(x => ({ row: fb.row, x }));
  sc.arrive = { at: from - ARRIVE_S * SEC, seat: { x: fb.seats?.[0] ?? fb.x, z: fb.z } };
  m.outFrom += shift; m.outUntil += shift;
  sc.fear = Math.min(100, sc.fear + SIGNAL_FEAR);
  say(state, bus, { kind: 'note', text: `A hand to your hat as you pass, the danger sign. ${nameOf(state)} folds ${Pr.his} paper and goes. The fallback: ${fb.label.charAt(0).toLowerCase()}${fb.label.slice(1)}, ${clockText(from)}.` });
}
/** The fallback: a bench of a park within two streets of the bench, 60 m off at least: { row, x, z, seats, label }, or null. */
function fallbackPlace(state) {
  const sc = state.scenario, town = townOf(state.map), r = stream('x-fallback', state.map.seed, state.assignment ?? 'x');
  for (let k = 0; k < 40; k++) {
    const row = sc.at.row + int(r, 5) - 2, i = Math.floor(sc.at.x / SECTION_M) + int(r, 9) - 4, S = sectionOf(town, row, i);
    const b = S.band === 'park' && S.props.filter(q => q.kind === 'bench' && q.seats?.length)[0];
    if (!b || (row === sc.at.row && Math.abs(b.seats[0] - sc.at.x) < 60)) continue;
    return { row, x: b.seats[0], z: 12.96, seats: b.seats.slice(), kind: 'bench', label: `A bench in ${placeName(town, row, b.seats[0], 14)}, by ${streetName(town, row)}` };
  }
  return null;
}

/** T by them while they're running: caught up; a hand on the arm, and they're with you again, steadier a while. */
function caughtUp(state, bus, comp) {
  const sc = state.scenario, Pr = P(state);
  if (!sc.bolt || !comp) return;
  sc.bolt = null; sc.fear = Math.min(sc.fear, CAUGHT_FEAR); sc.steadyUntil = state.time.ms + STEADY_S * SEC; comp.ai.route = null; comp.ai.pace = 1;
  say(state, bus, { kind: 'note', text: `A hand on ${Pr.his} arm: "It's me. Walk." ${cap(Pr.he)}'s shaking, and walks.` });
}

/** A word, low, to steady them: your Social against CALM_DC. */
function calm(state, bus, comp) {
  const sc = state.scenario, p = state.people[state.player], Pr = P(state);
  if (!comp || state.time.ms - sc.calmAt < CALM_S * SEC) return say(state, bus, { kind: 'instinct', text: 'You\'ve said it. Let it sink in.' });
  sc.calmAt = state.time.ms; sc.stats.calms++;
  const roll = check(state.rng, { skill: 'social', value: skill(p, 'social'), dc: CALM_DC, body: p });
  sc.fear = Math.max(0, sc.fear - (roll.ok ? CALM_WON : CALM_LOST));
  say(state, bus, { kind: 'roll', roll, text: roll.ok ? `"Look at me, not at them. We're going for a drink, that's all." ${cap(Pr.his)} shoulders come down an inch.` : `"Easy." ${cap(Pr.he)} nods too fast, and keeps looking at faces.` });
}

/** T at a safe house's door, them beside you: in, both of you, out of sight; its card. */
function enterHouse(state, bus, me, comp, id) {
  const sc = state.scenario, h = sc.houses.find(x => x.id === id), Pr = P(state);
  if (!h || !comp || sc.held || distOf(state, me, comp) > WITH_M) return say(state, bus, { kind: 'instinct', text: `Not without ${nameOf(state)} beside you.` });
  // (one of theirs who has them in sight, or had them a moment ago: he's seen the door)
  for (const [aid, W] of Object.entries(sc.opp)) {
    const a = actorOf(state, aid);
    if (a && W.knows && !W.watching && (sight(state, a, comp) || (W.seen && state.time.ms - W.seen.ms < 8 * SEC))) { sc.houseSeen = h.id; W.door = { row: h.row, x: h.x }; }
  }
  sc.inside = { h: h.id, since: state.time.ms };
  if (!sc.used.includes(h.id)) sc.used.push(h.id);
  Object.assign(me, { hidden: true, vx: 0, vz: 0 }); Object.assign(comp, { hidden: true, vx: 0, vz: 0, row: myRow(state), x: me.x, z: me.z });
  comp.ai.route = null; comp.ai.follow = null; sc.bolt = null;
  for (const W of Object.values(sc.opp)) if (W.knows && !W.watching && !W.door) { W.knows = null; W.lostAt = state.time.ms; }
  say(state, bus, { kind: 'note', text: `Up the stairs, the key where it always is, the door shut behind the two of you. ${nameOf(state)} sits down on the bed and puts ${Pr.his} face in ${Pr.his} hands.` });
  safeCard(state, bus);
}

/** What the safe house has for them (and you): the card's ways. */
function safeWays(state) {
  const sc = state.scenario, h = sc.houses.find(x => x.id === sc.inside?.h), p = state.people[state.player], cp = state.people.comp, Pr = P(state), out = [];
  if (!h) return out;
  if (!sc.dis.clothes) out.push({ key: 'clothes', label: `Other clothes (${CHANGE_MIN} min)` });
  if (!cp.disguise && (p.equip?.disguise ?? 0) > 0) out.push({ key: 'kit', label: `Your kit on ${Pr.him} (${KIT_MIN} min)` });
  if (!cp.disguise) for (const f of h.faces ?? []) out.push({ key: `face:${f.id}`, label: `${cap(Pr.his)} new face (${ADV_ON_MIN} min)` });
  const mine = state.campaign?.posting?.safehouses.find(x => x.id === h.id)?.disguises?.filter(d => !d.for) ?? [];
  if (!p.disguise) for (const f of mine) out.push({ key: `mine:${f.id}`, label: `Your face: ${LOOKS[f.look]?.name.toLowerCase() ?? 'another'} (${ADV_ON_MIN} min)` });
  if (!sc.tea) out.push({ key: 'tea', label: `Tea (${TEA_MIN} min)` });
  out.push({ key: 'out', label: 'Out again' });
  return out;
}
function safeCard(state, bus) { bus?.emit('safehouse', safeWays(state)); }

/** The card's choice: its time, and what it makes of them. */
function safeChoice(state, bus, me, key) {
  const sc = state.scenario, cp = state.people.comp, p = state.people[state.player], Pr = P(state);
  if (!sc.inside) return;
  if (key === 'out') return leaveHouse(state, bus, me);
  let min = 0, line = '';
  if (key === 'clothes' && !sc.dis.clothes) {
    const r = stream('x-clothes', state.map.seed, state.time.ms), [color, trim] = pick(r, COATS.filter(([c]) => c !== cp.look.top?.color));
    cp.look = { ...cp.look, top: { ...(cp.look.top ?? {}), kind: 'coat', color, trim }, hat: pick(r, HATS) };
    sc.dis.clothes = true; min = CHANGE_MIN;
    line = `A coat from the wardrobe that was never ${Pr.his}, and a hat: from across a street, not the photograph's ${Pr.man}.`;
  } else if (key === 'kit' && !cp.disguise && (p.equip?.disguise ?? 0) > 0) {
    p.equip.disguise--;
    const L = cp.look, was = { hair: structuredClone(L.hair ?? null), glasses: L.glasses ?? null, moustache: !!L.moustache };
    if (L.hair && L.hair.style !== 'bald') L.hair = { ...L.hair, color: L.hair.color === 0xc4bba9 ? 0x47302a : 0xc4bba9 };
    if (L.glasses) delete L.glasses; else L.glasses = 'specs';
    cp.disguise = { q: Math.round(kitQuality(p) * ON_OTHER_K * 100) / 100, was };
    sc.dis.kit = true; min = KIT_MIN;
    line = `Your kit, on ${Pr.his} face this time: the hair another colour, ${L.glasses ? 'glasses' : 'no glasses'}, ${Pr.his} chin up to the lamp while you work. ${cp.disguise.q >= 0.7 ? `Not quite ${Pr.him}.` : `${cap(Pr.him)}, if anyone looks closely.`}`;
  } else if (key.startsWith('face:') && !cp.disguise) {
    const h = sc.houses.find(x => x.id === sc.inside.h), f = h?.faces?.find(x => x.id === key.slice(5));
    if (!f) return safeCard(state, bus);
    wearAdvanced(cp, f, h.id);
    h.faces = h.faces.filter(x => x !== f);
    const real = state.campaign?.posting?.safehouses.find(x => x.id === h.id);
    if (real?.disguises) real.disguises = real.disguises.filter(x => x.id !== f.id);
    sc.dis.face = true; min = ADV_ON_MIN;
    line = `Half an hour at the mirror with the latex and the glue, ${Pr.him} sitting very still: ${LOOKS[f.look]?.words ?? 'another face'}. Someone else looks back at ${Pr.him}, and ${Pr.he} doesn't like it.`;
  } else if (key.startsWith('mine:') && !p.disguise) {
    const real = state.campaign?.posting?.safehouses.find(x => x.id === sc.inside.h), f = real?.disguises?.find(x => x.id === key.slice(5) && !x.for);
    if (!f) return safeCard(state, bus);
    wearAdvanced(p, f, real.id);
    real.disguises = real.disguises.filter(x => x !== f);
    min = ADV_ON_MIN; line = `Your own turn at the mirror: ${LOOKS[f.look]?.words ?? 'another face'}.`;
  } else if (key === 'tea' && !sc.tea) {
    sc.tea = true; min = TEA_MIN; sc.fear = Math.max(0, sc.fear - TEA_FEAR);
    line = `Tea, with the lights off and the curtains an inch apart. ${cap(Pr.he)} drinks it with both hands, and stops shaking.`;
  } else return safeCard(state, bus);
  say(state, bus, { kind: 'note', text: line });
  skipInside(state, bus, min * MIN);
  if (!sc.outcome) safeCard(state, bus);
}

/** Time in a safe house: the engine's skip (sim/game.js); the street goes on: theirs have walked on, somewhere about their search. */
function skipInside(state, bus, ms) {
  const sc = state.scenario;
  skip(state, bus, ms);
  const now = state.time.ms, spread = LEG_M + (now - sc.began) / MIN * LEG_GROW_M;
  for (const [id, W] of Object.entries(sc.opp)) {
    const a = actorOf(state, id);
    if (!a || W.kind !== 'searcher' || W.door) continue;
    const r = stream('x-moved', state.map.seed, id, now), base = sc.lastSeen && now - sc.lastSeen.ms < RADIO_FRESH_MIN * MIN ? sc.lastSeen : sc.anchor;
    const rows = rowsOut(sc, now);
    Object.assign(a, { row: base.row + int(r, 2 * rows + 1) - rows, x: base.x + range(r, -spread, spread), z: chance(r, 0.5) ? LINE.F : LINE.N, vx: 0, vz: 0 });
    a.ai.route = null;
    leg(state, a);
  }
}

/** Out of the safe house, both of you, at its door; whoever saw you go in waiting there. */
function leaveHouse(state, bus, me) {
  const sc = state.scenario, comp = compOf(state), h = sc.houses.find(x => x.id === sc.inside?.h);
  if (!sc.inside) return;
  sc.inside = null;
  Object.assign(me, { hidden: false });
  if (comp) { Object.assign(comp, { hidden: false, row: myRow(state), x: me.x + 0.9, z: me.z + 0.3 }); comp.ai.route = null; }
  // (whoever saw the door: on the pavement outside it, and he'll look again, at a face that may not be the one he saw go in)
  for (const [id, W] of Object.entries(sc.opp)) {
    const a = actorOf(state, id);
    if (!W.door || !a || !h || W.door.row !== h.row) continue;
    Object.assign(a, { row: h.row, x: h.x + 9, z: LINE.F }); a.ai.route = null; W.door = null; W.looked = 0; W.closeLook = false; W.knows = null;
  }
  say(state, bus, { kind: 'note', text: sc.dis.clothes || sc.dis.kit || sc.dis.face ? `Out again, the two of you, ${nameOf(state)} in a ${sc.dis.face ? 'face' : 'coat'} they've never seen.` : 'Out again, the two of you, into the street.' });
}

/** T at the car with them beside you: in, the door shut, and it drives off (LEAVE_S, and it's over). */
function handOver(state, bus, me, comp) {
  const sc = state.scenario, now = state.time.ms, Pr = P(state);
  if (!comp || sc.held || distOf(state, me, comp) > WITH_M) return say(state, bus, { kind: 'instinct', text: `Not without ${nameOf(state)} beside you.` });
  if (sc.circling) return say(state, bus, { kind: 'instinct', text: 'The van\'s gone round the block. Wait for it.' });
  if (now < sc.mission.outFrom || !sc.driver) return say(state, bus, { kind: 'instinct', text: `Not yet: the car comes at ${clockText(sc.mission.outFrom)}.` });
  const watched = Object.entries(sc.opp).find(([id, W]) => W.knows && !W.watching && sight(state, actorOf(state, id), comp));
  Object.assign(comp, { hidden: true, vx: 0, vz: 0 }); comp.ai.follow = null; comp.ai.route = null;
  state.actors = state.actors.filter(x => x.id !== sc.driver); sc.driver = null;
  if (sc.car) letGo(state, sc.car);
  if (watched) {
    const a = actorOf(state, watched[0]);
    if (a && sight(state, a, me)) link(state, bus, a);
    sc.leaving = { at: now + LEAVE_S * SEC, outcome: 'taken', text: `The door shuts on ${Pr.him}, the car pulls out; and the ${state.people[a.who].sex === 'f' ? 'woman' : 'man'} who'd had ${Pr.him} in ${W_(state, a).his} eyes is talking into ${W_(state, a).his} collar. Two streets on, a police car across the road, and its lights.` };
  } else sc.leaving = { at: now + LEAVE_S * SEC, outcome: 'out', text: `The driver has the back door open before you reach it. ${nameOf(state)} is in and down on the floor under a coat, the door's shut, and the car pulls out into the traffic without hurrying. By morning ${Pr.he}'ll be over the border. You walk the other way.` };
  sc.prompt = null;                                                 // (nothing to do now but watch it go)
  say(state, bus, { kind: 'note', text: `${nameOf(state)} in, the door shut, and the car pulls away.` });
}

/** Onto a ride with them (phase 'on': they come if they're beside you, and a face may be known; 'off': out beside you). Decided once. */
function ride(state, bus, phase, knows, how) {
  const sc = state.scenario, me = playerOf(state), comp = compOf(state);
  if (sc.outcome || !comp || sc.phase !== 'with') return;
  if (phase === 'on') {
    if (sc.boarded) return;                                         // (the taxi that stopped for you: decided as you got in, onBoard())
    sc.boarded = true;
    const d = distOf(state, me, comp);                               // (beside you, or following and a few steps back: in after you while it waits)
    sc.rideWith = !sc.held && !sc.bolt && (d <= WITH_M || (d <= RIDE_WITH_M && knowsMe(state, comp)));
    if (!sc.rideWith) { sc.fear = Math.min(100, sc.fear + 40); return; }
    sc.stats.rides++;
    Object.assign(comp, { hidden: true, vx: 0, vz: 0 }); comp.ai.route = null; comp.ai.follow = null;
    const r = stream('x-ride', state.map.seed, state.time.ms);
    if (chance(r, knows * exposure(state))) {
      if (how === 'taxi') { link(state, bus, null, 'the driver'); return end(state, bus, 'taken', `The driver's eyes in the mirror on ${nameOf(state)}, a second too long. Then he doesn't take the turn you asked for, and the doors lock themselves. He'd seen the evening news.`); }
      sc.lastSeen = { row: myRow(state), x: me.x, ms: state.time.ms }; sc.rideSeen = true;   // (a rider who knew the face from the news, on the phone: they'll be at the other end)
    }
    // (one of theirs who had them in sight as they got in: the plate, the bus's number, the station, on the radio; or not)
    if (Object.entries(sc.opp).some(([id, W]) => W.knows && !W.watching && sight(state, actorOf(state, id), comp)) && chance(r, KEPT_P)) sc.rideSeen = true;
    for (const W of Object.values(sc.opp)) if (W.knows && !W.watching) { W.knows = null; W.lostAt = state.time.ms; }
    return;
  }
  sc.boarded = false;
  if (!sc.rideWith) return;
  sc.rideWith = false;
  Object.assign(comp, { hidden: false, row: myRow(state), x: me.x + 0.8, z: me.z, vx: 0, vz: 0 }); comp.ai.route = null;
  if (sc.rideSeen) { sc.rideSeen = false; radio(state, null, { row: myRow(state), x: me.x }); }
}

/** Where you are, for T: at the car's kerb, at a safe house's door. */
export function here(state, me) {
  const sc = state.scenario, O = sc.out, row = myRow(state);
  return { car: row === O.row && Math.abs(me.x - O.x) < CAR_M && Math.abs(me.z - O.z) < 3, house: sc.houses.find(x => x.row === row && Math.abs(x.x - me.x) < SAFE_REACH_M && me.z < Z.kerbN) ?? null };
}
/** How far a place is, in the instinct's words: '40 m east', '3 streets north'. */
const farTo = (state, me, pl) => (pl.row === myRow(state) ? `${Math.round(Math.abs(pl.x - me.x))} m ${dirOf(me.x, pl.x)}` : rowsText(pl.row - myRow(state)));

// ---------- the instinct (a line each: one clause, twelve words at most) ----------

const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const fearWord = (f) => (f >= 85 ? 'panicking' : f >= 65 ? 'scared' : f >= 45 ? 'nervous' : 'steady');
function* instinct(state, me, comp, now) {
  const sc = state.scenario, L = (id, tone, text, act = null, more = {}) => ({ id, tone, text, act, ...more }), who = nameOf(state), Pr = P(state);
  if (!comp) return;
  const dC = distOf(state, me, comp);
  if (sc.held) {
    const a = actorOf(state, sc.held.by), w = a ? W_(state, a) : pron('m'), near = a && distOf(state, me, a) <= REACH_T_M + 0.5;
    yield L('held', 'urgent', near ? `${a ? them_(state, a) : 'One of them'} has ${who}. {interact}: hit ${w.him}.` : `${a ? them_(state, a) : 'One of them'} has ${who}: close in.`); return;
  }
  if (sc.bolt) { yield L('bolt', 'urgent', dC <= REACH_T_M ? `${who}, in reach. {instinct}: a hand on ${Pr.his} arm.` : `${who}'s running, ${farTo(state, me, { row: rowOf(state, comp), x: comp.x })}. After ${Pr.him}.`, dC <= REACH_T_M ? 'catch' : null); return; }
  const closing = Object.entries(sc.opp).map(([id, W]) => [actorOf(state, id), W]).filter(([a, W]) => a && W.knows && !W.watching && W.spotted && rowOf(state, a) === myRow(state)).sort((x, y) => distOf(state, x[0], comp) - distOf(state, y[0], comp))[0];
  if (closing) yield L('closing', 'urgent', `${them_(state, closing[0])} has ${who}: lose ${W_(state, closing[0]).him}.`);
  const tailed = sc.tail && !sc.tail.teamLost && Object.values(sc.tail.suspects ?? {}).some(v => v >= 2);
  if (sc.phase === 'wait') {
    const post = Object.entries(sc.opp).find(([id, W]) => W.kind === 'post' && W.at === 'pickup' && W.spotted && actorOf(state, id) && rowOf(state, actorOf(state, id)) === myRow(state));
    if (signalOk(state, me, comp)) yield L('signal', 'warn', `${post ? 'Theirs by the bench' : 'A tail on you'}. {instinct}: wave ${Pr.him} off.`, 'signal');
    if (sc.arrive) yield L('early', 'calm', sc.signalled ? `The fallback: ${farTo(state, me, sc.at)}, ${clockText(sc.meetFrom)}.` : `${who}'s due at ${clockText(sc.meetFrom)}.`);
    else if (dC < MEET_M) yield L('meet', 'warn', `${who}, on the bench. {instinct}: ${sc.mission.companion.knows ? `sit with ${Pr.him}` : 'the parole'}.`, 'meet');
    else yield L('bench', 'calm', `${who}'s bench: ${farTo(state, me, sc.at)}, till ${clockText(sc.waitUntil)}.`);
    if (post && !sc.arrive) yield L('post', 'warn', 'The man by the bench is theirs.');
    if (tailed) yield L('tailed', 'warn', 'A tail on you. Lose them before the bench.');
    return;
  }
  const O = sc.out, k = here(state, me), h = k.house;
  if (k.car && sc.circling) yield L('circling', 'warn', 'The van\'s gone round the block: theirs by it.');
  else if (k.car) yield now < sc.mission.outFrom || !sc.driver ? L('early', 'warn', `The car's kerb. Not till ${clockText(sc.mission.outFrom)}.`, 'early') : L('car', 'warn', `The car. {instinct}: ${who} in.`, 'car');
  if (h && !sc.used.includes(h.id)) yield L('safe', 'warn', 'The safe house. {instinct}: in, both of you.', 'safe', { house: h.id });
  if (me.gait === 'run') yield L('run', 'urgent', 'Don\'t run: a running man is the one.');
  if (tailed) yield L('tailed', 'warn', `A tail on you, and ${who} beside you. Lose them.`);
  if (dC > 8 && dC < 40) yield L('behind', 'warn', `${who}'s ${Math.round(dC)} m back. {slow}: stroll.`);
  if (!comp.hidden && !knowsMe(state, comp) && !sight(state, me, comp) && sc.apartSince && now - sc.apartSince > GONE_S * SEC) yield L('gone', 'urgent', `Where's ${who}? Back the way you came.`);
  if (sc.fear >= 65 && dC <= CALM_M && now - sc.calmAt >= CALM_S * SEC) yield L('calm', 'warn', `${who}'s ${fearWord(sc.fear)}. {instinct}: a word to steady ${Pr.him}.`, 'calm');
  const spotted = Object.entries(sc.opp).map(([id, W]) => [actorOf(state, id), W]).filter(([a, W]) => a && W.spotted && !W.knows && !a.hidden && rowOf(state, a) === myRow(state) && Math.hypot(a.x - me.x, a.z - me.z) < 35 && !(a.ai.downUntil > now)).sort((x, y) => Math.hypot(x[0].x - me.x, x[0].z - me.z) - Math.hypot(y[0].x - me.x, y[0].z - me.z))[0];
  if (spotted && !k.car && !h) yield L('spotted', 'warn', `${spotted[1].kind === 'cop' ? 'Police' : 'Theirs'}, ${Math.round(Math.abs(spotted[0].x - me.x))} m ${dirOf(me.x, spotted[0].x)}. Keep people between.`);
  const left = Math.round((sc.mission.outUntil - now) / MIN), way = farTo(state, me, O);
  if (left <= 15) yield L('late', 'warn', `${left} min before the car goes.`);
  const nextH = sc.houses.find(x => x.row === myRow(state) && !sc.used.includes(x.id));
  if (nextH && !h) yield L('house-here', 'calm', `A safe house on this street, ${farTo(state, me, nextH)}.`);
  if (!sc.used.length && sc.houses.length) { const hh = sc.houses.slice().sort((x, y) => Math.abs(x.row - myRow(state)) - Math.abs(y.row - myRow(state)))[0]; if (hh.row !== myRow(state)) yield L('house', 'calm', `A safe house ${rowsText(hh.row - myRow(state))}: another coat for ${Pr.him}.`); }
  yield L('way', 'calm', `The car: ${way}, ${now < sc.mission.outFrom ? `from ${clockText(sc.mission.outFrom)}` : `${left} min left`}.`);
}

function end(state, bus, outcome, text) {
  const sc = state.scenario;
  if (sc.outcome) return;
  Object.assign(sc, { outcome, phase: 'done', endText: text, ended: state.time.ms, inside: null, leaving: null });
  const me = playerOf(state);
  if (me) me.hidden = false;
  if (sc.tail?.flags?.length) addHeat(state, FLAG_HEAT * sc.tail.flags.length);   // (what the team on you wrote down: sim/scenarios/sdr.js)
  for (const e of state.log) if (e.hidden && e.ms >= sc.began) e.hidden = false;   // (what they did, shown at the end)
  bus?.emit('scenario-end', outcome);
}
