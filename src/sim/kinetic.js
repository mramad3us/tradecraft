// TRADECRAFT sim: the kinetic missions (DESIGN.md, The kinetic missions (0.2.0 candidates); the user, 2026-11-04: "the
// missions we will be undertaking in these undercover and illegal postings will include covert assassinations, agent and
// burned officers extraction or abductions (depending on ally or enemy), sabotage and destruction of buildings,
// infiltration in secure off limit areas and a few more highly kinetic assignments that will only start being available as
// undercover and more common as illegal and require advanced disguises").
//
// **The frame**, every kind's (MISSIONS: its name, its scene, whether it's built yet). A kinetic mission is an assignment of a
// deep posting's (kind KINDS.extract in sim/campaign.js, and the others as they come), never an official cover's: tasked,
// prepared for, played as a scene of its own on the posting's streets with the game's own systems, and folded back.
//   - **Tasked** (task()): by the station's word under a legend, the Center's for an illegal: a paper at a bench, its chalk
//     mark passed in the street (sim/dial.js signals(): the same drops the week's review comes by). The assignment is on the
//     books from then (status 'word', a.word: the drop's hours), but only on the schedule (status 'open', the mind's Ahead,
//     its place on the streets) once the paper's been read (opened()): a word never collected (cleared after the drop's
//     hours) is the station's work done without you, and what it was for goes as it would have gone (lapsed()).
//   - **How often**: what happens in the posting's own world first (an asset met with a tail on you, compromised: the
//     station's word to bring him out, RESCUE_P by the rung, before the arrest's dice get to him: onBurned()); and the
//     station's own business, STATION_P a day by the rung (a colleague blown, to come: the other kinds), daily(). Rarer
//     undercover, commoner as an illegal (the user's words). One at a time, never in a posting's first FIRST_DAYS, GAP_DAYS
//     after the last.
//   - **The preparation** (PREP_DAYS between the word and its hour: a day and a half): the means through Agency Support or
//     the black market (sim/dial.js: a clean gun, a disguise kit; a face for whoever you're bringing out, faceFor(): the
//     disguise officer's, made from their photograph and left at a safe house); and the reconnaissance (recce(), in your own
//     hours): walked past its places before its day, within RECCE_M, your Awareness against RECCE_DC reads whoever the
//     opposition has posted there (m.posts): seen, the brief and the instinct know him, and the scene marks him.
//   - **The scene** (sim/scenarios/<kind>.js): at its place in its hour, T, as any assignment (sim/scenarios/campaign.js
//     begin()), with the engine's police, emergency services and hunt in it (scenario.police) and the posting's safe houses.
//   - **Its window**: the hour it begins in (the pickup's PICKUP_WAIT_MIN), and its way out's (OUT_FROM_MIN to
//     OUT_UNTIL_MIN after it).
//   - **Folded back** (foldMission()): the intelligence (whoever's brought out, debriefed), the station's thanks (support),
//     the network (the others' trust), heat (seen with them: LINKED_HEAT; the arrest's), the hunt (the engine's, outliving
//     the scene), being taken (sim/prison.js caught(): no legend holds when you're caught walking a traitor to a car) or killed.
// **Extraction** (the first built; its scene is sim/scenarios/extraction.js): an asset of the network about to be arrested,
// or a colleague of the station's under a legend of their own, blown and hiding: met at a bench (sim/places.js), taken by a
// safe house for another face, walked across the city with the opposition looking for them, handed over at a car OUT_ROWS
// streets off. Their file (companionOf()): a name, a look (an asset's own), their Deception (an asset's an amateur's, a
// colleague's a trained officer's), their fitness and age (their pace), whether they know your face (an asset does; a
// colleague has a parole).
// **A debug start** (debugMission()): a deep campaign made up on the spot with an extraction about to begin, for the browser's
// ?mission=extraction and window.__tradecraft.mission() (src/main.js), so a reviewer needn't play a career to reach one.
import { stream, int, pick, chance, range, hash } from './rng.js';
import { DAY, HOUR, MIN, calendar, clockText } from './clock.js';
import { townOf, cityById, serviceOf } from './cities/index.js';
import { sectionOf, LINE } from './city.js';
import { Z, SECTION_M, streetName, placeName } from './map/street.js';
import { missionPlace, settle } from './places.js';
import { ciOf } from './incubation.js';
import { isDeep, NATIONS } from './legends.js';
import { streetLook } from './people.js';
import { skill } from './skills.js';
import { check } from './checks.js';
import { supportOf } from './support.js';
import { briefOf } from './dossier.js';
import { say } from './log.js';

export const MISSIONS = {
  extract: { name: 'An extraction', scenario: 'extraction', built: true, about: 'Bring someone of ours out before they\'re taken: find them, change their face, walk them across a city that\'s looking for them, and hand them over.' },
  kill: { name: 'A covert killing', built: false },               // (the umbrella chapter, sim/scenarios/tail.js umbrellaTest, its seed)
  take: { name: 'An abduction', built: false },
  enter: { name: 'An infiltration', built: false },
  wreck: { name: 'Sabotage', built: false },
};
export const KINETIC = new Set(Object.keys(MISSIONS));
/** Whether an assignment is a kinetic mission's. */
export const isKinetic = (a) => KINETIC.has(a?.kind);

// How often: the station's own taskings a day, by the rung; an asset compromised, the word to bring him out (else the arrest's dice).
export const STATION_P = { undercover: 1 / 50, illegal: 1 / 20 };
export const RESCUE_P = { undercover: 0.45, illegal: 0.65 };
export const FIRST_DAYS = 5, GAP_DAYS = 10;
// The timing: the word the morning after, the hour the evening after that (PREP_DAYS), the drop's hours (sim/dial.js DROP_FOR_H).
export const PREP_DAYS = 1, WORD_H = 7, PICKUP_H = [19, 21.5], PICKUP_WAIT_MIN = 25;
// The way out: OUT_ROWS streets from the pickup, open OUT_FROM_MIN to OUT_UNTIL_MIN after its hour.
export const OUT_ROWS = [4, 6], OUT_FROM_MIN = 15, OUT_UNTIL_MIN = 150;
// The opposition's posts at its places (by the country's counter-intelligence: × ci), and the recce's look at them.
export const POST_P = { pickup: 0.35, out: 0.45 }, RECCE_M = 45, RECCE_DC = 13;
// Folded back: the debrief's intelligence, the station's thanks, the heat of a face seen beside theirs, of an arrest.
export const OUT_INTEL = { asset: 3, colleague: 2 }, OUT_AS = 10, LINKED_HEAT = 30, TAKEN_HEAT = 12, LOST_HEAT = 6;

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const dayOf = (ms) => Math.floor(ms / DAY);
const hm = (ms) => clockText(ms);

/** The open kinetic mission, tasked or on the schedule (status 'word' or 'open'), or null. */
export const pendingOf = (c) => c.assignments.find(a => isKinetic(a) && (a.status === 'word' || a.status === 'open')) ?? null;
/** The posting's rung for the missions: 'undercover', 'illegal', or null (official cover, a first tour: none). */
const rungOf = (c) => (isDeep(c?.posting) ? c.posting.level : null);

// ---------- who's brought out ----------

const COLLEAGUE_JOBS = ['a sales engineer for a Danish valve maker', 'a lecturer at the languages institute', 'a stringer for a Swiss paper', 'the agent of a Belgian shipping line',
  'a buyer for a Dutch flower importer', 'a translator at a technical bureau'];
const PAROLES = [['Excuse me, is this the bench for the number 9?', 'Only on Sundays, and never on time.'], ['Have you a light? Mine\'s gone out in the wind.', 'I gave up, the winter before last.'],
  ['Is this seat taken, or is it the pigeons\'?', 'The pigeons\', but they won\'t mind.'], ['You dropped this, I think: a glove.', 'Not mine. My gloves are both at home.']];
/**
 * Whoever's brought out, as the scene needs them: { kind ('asset' | 'colleague'), id, name, codename, role, sex, age, look,
 * deception, awareness, fitness, knows (your face), parole }. An asset's from the network (s); a colleague's made up, of the
 * station's, under a legend of their own.
 */
export function companionOf(c, s, r) {
  const p = c.posting, K = cityById(p.city);
  if (s) {
    const age = 35 + int(r, 25), [given, family] = K.people.name(r, s.sex ?? 'm', age);
    return { kind: 'asset', id: s.id, name: `${given} ${family}`, codename: s.codename, role: s.role, sex: s.sex ?? 'm', age, look: structuredClone(s.look), deception: 6 + int(r, 4), awareness: 5 + int(r, 3), fitness: 5 + int(r, 5), knows: true, parole: null };   // (an amateur, but one who's lived a double life for months)
  }
  const sex = chance(r, 0.4) ? 'f' : 'm', age = 30 + int(r, 18), N = pick(r, NATIONS), look = streetLook(r, sex, age);
  delete look.carry;
  return { kind: 'colleague', id: `colleague${hash(c.seed, p.startMs, 'colleague') % 1e5}`, name: `${pick(r, N[sex])} ${pick(r, N.family)}`, codename: null, role: `one of the station's, under a legend of ${sex === 'f' ? 'her' : 'his'} own as ${pick(r, COLLEAGUE_JOBS)}`,
    sex, age, look, deception: 12 + int(r, 5), awareness: 11 + int(r, 4), fitness: 9 + int(r, 5), knows: false, parole: pick(r, PAROLES), nation: N.word };
}
/** What to call them on the street: an asset by codename, a colleague by the name on their papers. */
export const callOf = (m) => m.companion.codename ?? m.companion.name.split(' ')[0];

// ---------- the way out ----------

const OUT_CARS = {
  moscow: { undercover: ['a grey Volvo with diplomatic plates, its boot unlocked', 'a dark-blue Saab with diplomatic plates'], illegal: ['a bread van with nobody\'s name on it', 'a lorry with Finnish plates and a false floor'] },
  beirut: { undercover: ['a white Land Cruiser with diplomatic plates', 'a grey Peugeot with CD plates, the engine ticking'], illegal: ['a produce truck for the Bekaa, its crates half empty', 'a fishmonger\'s van, smelling of it'] },
  cairo: { undercover: ['a black Mercedes with CD plates', 'a white Toyota with diplomatic plates and tinted glass'], illegal: ['a tour company\'s spare minibus', 'a bread van on its night round'] },
};
/** The hand-over: { row, x, z, car: { x, z } | null, label, words } OUT_ROWS streets from the pickup (at), past the nearest safe house's street, by a parked car where there's one. */
export function outPlace(c, at, r, via = null) {
  const p = c.posting, town = townOf({ seed: p.mapSeed, city: p.city }), rung = rungOf(c) ?? 'undercover';
  // (the station picks it with the safe house on the way: from the bench toward it, OUT_ROWS on)
  const H = via ?? p.safehouses.filter(h => !h.burned).sort((x, y) => Math.abs(x.row - at.row) - Math.abs(y.row - at.row))[0];
  const dir = Math.sign((H?.row ?? at.row) - at.row) || (chance(r, 0.5) ? 1 : -1), row = at.row + dir * (OUT_ROWS[0] + int(r, OUT_ROWS[1] - OUT_ROWS[0] + 1));
  const ex = at.x + (chance(r, 0.5) ? 1 : -1) * range(r, 40, 140), cars = [];
  for (let i = Math.floor((ex - 40) / SECTION_M); i <= Math.floor((ex + 40) / SECTION_M); i++) for (const q of sectionOf(town, row, i).props) if (q.kind === 'car' && q.z < Z.fence) cars.push(q);
  const car = cars.sort((a, b) => Math.abs(a.x - ex) - Math.abs(b.x - ex))[0];
  const words = pick(r, (OUT_CARS[p.city] ?? OUT_CARS.moscow)[rung] ?? OUT_CARS.moscow.undercover);
  const x = car ? Math.round((car.x - 1.2) * 10) / 10 : Math.round(ex * 10) / 10;
  return { row, x, z: car ? Z.kerbN - 0.75 : LINE.N, car: car ? { x: car.x, z: car.z } : null, words, label: `${cap(words.split(',')[0])}, by ${placeName(town, row, x, 0)}`, street: streetName(town, row) };
}

// ---------- tasked ----------

/**
 * The station's word (the Center's, for an illegal): a mission of `kind` about `s` (an asset of the network, or null: a
 * colleague), the word at a bench the morning after `ms`, its hour the evening after that. The assignment (status 'word')
 * and the signal (c.signals: sim/dial.js signals()). Returns the assignment, or null (not now: one's pending, too soon).
 */
export function task(c, kind, s, ms) {
  const p = c.posting;
  if (!rungOf(c) || c.over || c.blown || pendingOf(c) || !MISSIONS[kind]?.built) return null;
  settle(c);                                                        // (its places on the streets as they're marked: sim/places.js)
  const last = c.done.filter(isKinetic).at(-1), d = dayOf(ms);
  if (d - dayOf(p.startMs) < FIRST_DAYS || (last && d - dayOf(last.ended ?? last.to) < GAP_DAYS)) return null;
  const r = stream('kinetic', c.seed, kind, d, s?.id ?? 'station'), word = (d + 1) * DAY + WORD_H * HOUR, pd = d + 1 + PREP_DAYS;
  const from = pd * DAY + Math.round(range(r, ...PICKUP_H) * 60) * MIN;
  const companion = companionOf(c, s, r);
  // (the station means you to use a safe house: the bench near it, the way out past it)
  const houses = p.safehouses.filter(h => !h.burned), via = houses.length ? pick(r, houses) : null;
  const a = { id: `k${hash(c.seed, kind, from) % 1e7}`, kind, who: companion.id, from, to: from + PICKUP_WAIT_MIN * MIN, start: from - 10 * MIN, status: 'word', word: { from: word, until: from },
    mission: { kind, companion, tasked: ms, ci: ciOf(p.city), searchers: null, posts: null, recce: {}, ...(via ? { near: via.row, via: via.id } : {}) } };
  c.assignments.push(a);
  c.assignments.sort((x, y) => x.from - y.from);
  const at = missionPlace(c, a);                                    // (a bench, chosen once: sim/places.js)
  if (!at) { c.assignments = c.assignments.filter(x => x !== a); return null; }
  // (the evening's other business set aside: the station says nothing else that day)
  for (const x of c.assignments) if (x.status === 'open' && !isKinetic(x) && dayOf(x.from) === pd) x.status = 'unplanned';
  c.assignments = c.assignments.filter(x => x.status !== 'unplanned');
  const m = a.mission, ci = m.ci;
  m.out = outPlace(c, at, r, via);
  m.outFrom = from + OUT_FROM_MIN * MIN; m.outUntil = from + OUT_UNTIL_MIN * MIN;
  // (whom they've posted where: at the pickup, a man who's been watching him and waits to see who comes; at the way out, a
  // post that reads every face that passes; the searchers, by the service and the heat)
  m.posts = { pickup: companion.kind === 'asset' && chance(r, POST_P.pickup * ci), out: chance(r, POST_P.out * ci) };
  m.searchers = 2 + Math.round(ci * 2 + range(r, -0.4, 0.6)) + (p.heat >= 50 ? 1 : 0);
  if (s) s.rescue = a.id;                                            // (told to lie low till then: the arrest's dice wait, sim/campaign.js pass())
  (c.signals ??= []).push({ from: word, mission: a.id, paper: wordPaper(c, a) });   // (the chalk mark says where, when you pass it: sim/dial.js)
  return a;
}
const dateWord = (ms) => { const k = calendar(ms); return `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][k.weekday]} ${hm(ms)}`; };

/** The word itself: the paper at the drop (the brief's paragraphs, sim/dossier.js). */
function wordPaper(c, a) {
  const B = briefOf(c, a), ill = c.posting.level === 'illegal';
  return { kind: 'cable', title: `${ill ? 'THE CENTER' : 'THE STATION'}: ${B.title}`, lines: [...B.body, `On the schedule from now: Ahead (Tab) has the bench, ${dateWord(a.from)}.`] };
}

/** An asset met with a tail on you (sim/campaign.js fold(), 'burned'): the word to bring him out, RESCUE_P by the rung. */
export function onBurned(c, s, ms) {
  const rung = rungOf(c);
  if (!rung || s.rescue || !chance(stream('kinetic-rescue', c.seed, s.id, dayOf(ms)), RESCUE_P[rung])) return null;
  return task(c, 'extract', s, ms);
}

/** A day of the posting (sim/campaign.js pass()): the station's own business, STATION_P by the rung. */
export function daily(c, d) {
  const rung = rungOf(c);
  if (!rung || !chance(stream('kinetic-day', c.seed, d), STATION_P[rung])) return null;
  return task(c, 'extract', null, d * DAY + 20 * HOUR);
}

/** The word read (at its bench: sim/dial.js collect()): on the schedule now. */
export function opened(c, id, ms) {
  const a = c.assignments.find(x => x.id === id && x.status === 'word');
  if (!a) return null;
  a.status = 'open'; a.read = ms;
  return a;
}

/** The word never read (its drop cleared): the station's work done without you. Its papers. */
export function lapsed(c, id, ms) {
  const a = c.assignments.find(x => x.id === id && x.status === 'word');
  if (!a) return [];
  a.status = 'missed'; a.ended = ms; a.outcome = 'unread'; a.known = 'unread';
  c.done.push(a);
  return taken(c, a, ms, false, 'Nobody came for the word at the drop. Whoever was to be brought out waited, and went home, and they were waiting there.');
}

// ---------- the reconnaissance ----------

/**
 * In your own hours (the campaign's hub, once a second): past a mission's places before its day, within RECCE_M, a look at
 * them (once each): your Awareness against RECCE_DC; made, you know whether they've a man there.
 */
export function recce(state, bus, me) {
  const c = state.campaign, p = c?.posting;
  if (!p || !me || state.map.kind !== 'street' || state.map.seed !== p.mapSeed) return;
  const row = state.map.row ?? 0, now = state.time.ms;
  for (const a of c.assignments) {
    if (!isKinetic(a) || a.status !== 'open' || now >= a.start) continue;
    const m = a.mission, at = missionPlace(c, a);
    for (const [key, pl] of [['pickup', at], ['out', m.out]]) {
      if (!pl || pl.row !== row || m.recce[key] || Math.abs(me.x - pl.x) > RECCE_M) continue;
      const p0 = state.people[state.player], roll = check(stream('recce', c.seed, a.id, key), { skill: 'awareness', value: skill(p0, 'awareness'), dc: RECCE_DC, body: p0 });
      m.recce[key] = { ms: now, ok: roll.ok, post: roll.ok ? !!m.posts[key] : null };
      const where = key === 'pickup' ? 'the bench' : 'the way out';
      say(state, bus, { kind: 'roll', roll, text: !roll.ok ? `${cap(where)}: you look it over in passing, and can't tell whether anyone's there for it.`
        : m.posts[key] ? (key === 'pickup' ? `${cap(where)}: a man on the next bench along, reading the same page twice, who looks up at every coat that passes. Theirs: he's watching for ${callOf(m)}.` : `${cap(where)}: a man in a doorway by the corner, smoking, reading every face that passes the car's kerb. Theirs.`)
          : `${cap(where)}: you look it over in passing. Nobody's there for it.` });
    }
  }
}

// ---------- the scene's context ----------

/** What the scene is set up with (sim/campaign.js context()): the mission, the safe houses, the faces made for them. */
export function contextOf(c, a, ctx) {
  settle(c);                                                        // (its places on the streets, if nothing's put them there yet: sim/places.js)
  const p = c.posting, m = a.mission;
  const houses = p.safehouses.filter(h => !h.burned).map(h => ({ id: h.id, row: h.row, x: h.x ?? 12, label: h.label, faces: (h.disguises ?? []).filter(d => d.for === a.id) }));
  Object.assign(ctx, { mission: structuredClone(m), houses, level: p.level, alias: p.alias ?? null, papers: p.papers ?? null, job: p.job, meetFrom: a.from, meetTo: a.to });
  return ctx;
}

/** A face for whoever's brought out (the disguise officer's, sim/dial.js): the open extraction's, or null. */
export const faceFor = (c) => c.assignments.find(a => a.kind === 'extract' && a.status === 'open') ?? null;

// ---------- folded back ----------

/** The papers of someone of ours arrested after it (now, or by the morning): the network, the heat. */
function taken(c, a, ms, linked, why) {
  const p = c.posting, m = a.mission, C = m.companion, s = C.kind === 'asset' ? p.assets.find(x => x.id === C.id) : null;
  if (s) { s.arrested = ms; delete s.rescue; }
  p.heat = Math.min(100, p.heat + (linked ? LINKED_HEAT : 0) + (s ? LOST_HEAT : 0));
  for (const o of p.assets) if (o !== s) o.trust = Math.max(-5, o.trust - 1);   // (the network hears: frightened)
  c.log.push({ ms, text: `${C.codename ?? C.name} arrested.` });
  return [{ kind: 'news', title: `${(C.codename ?? C.name).toUpperCase()}: ARRESTED`, lines: [why, s ? `The evening news: ${s.role} detained on suspicion of espionage.` : `A foreigner detained, the radio says: ${C.nation ?? 'a European'}, a name nobody at the station will say aloud.`,
    linked ? 'And they have your face beside theirs.' : 'Heat up. The others in the network will have heard by the weekend.'] }];
}

/**
 * The scene over (sim/campaign.js fold()): its outcome into the posting. lines: the debrief's, added to; papers out
 * (c.after: shown after the debrief). sc: the scene's state (outcome, linked: your face seen beside theirs).
 */
export function foldMission(c, a, sc, endMs, lines) {
  const p = c.posting, m = a.mission, C = m.companion, s = C.kind === 'asset' ? p.assets.find(x => x.id === C.id) : null, who = C.codename ?? C.name, o = sc.outcome;
  const linked = !!sc.linked, she = C.sex === 'f' ? 'she' : 'he', her = C.sex === 'f' ? 'her' : 'him';
  if (s) delete s.rescue;
  const H = sc.houseSeen && p.safehouses.find(h => h.id === sc.houseSeen);
  if (H && !H.burned) H.seen ??= endMs;                              // (seen going in with them: the cable says it's blown, sim/campaign.js pass())
  if (o === 'out') {
    const intel = OUT_INTEL[C.kind] ?? 2;
    a.intel = intel; p.intelligence += intel;
    if (s) { s.out = endMs; p.assets = p.assets.filter(x => x !== s); }
    const S = supportOf(c); if (S) p.support.now = Math.min(S.max, S.now + OUT_AS);
    for (const x of p.assets) x.trust = Math.min(5, x.trust + 1);
    if (linked) p.heat = Math.min(100, p.heat + LINKED_HEAT);
    lines.push(`${who} is out: over the border by morning, and debriefed for a week in a house with a garden. Intelligence +${intel}; the ${p.level === 'illegal' ? 'Center' : 'station'}'s thanks, support +${OUT_AS}.`,
      s ? `The network's one short, and the rest of it a little braver for knowing we take care of our own: trust up.` : `A colleague home, alive. Nobody will ever say so in writing.`,
      linked ? `They saw you with ${her}. Your face is in a file now beside ${who}'s: heat up, a lot.` : 'Nobody saw your face beside theirs, as far as you know.');
  } else if (o === 'taken') {
    (c.after ??= []).push(...taken(c, a, endMs, linked, `${who} was taken in the street, with you there.`));
    lines.push(`They took ${who}. ${linked ? `And they saw you with ${her}: heat up, a lot.` : 'You walked away, and nobody followed you, as far as you can tell.'}`);
  } else if (o === 'killed') {
    if (s) { s.arrested = endMs; p.assets = p.assets.filter(x => x !== s); }
    p.heat = Math.min(100, p.heat + TAKEN_HEAT + (linked ? LINKED_HEAT : 0));
    lines.push(`${who} is dead, on a pavement of ${cityById(p.city).name}. Whatever happens next, it happens without ${her}.`);
  } else if (o === 'captured' || o === 'dead') {
    lines.push(o === 'dead' ? 'The extraction ended with you.' : `They have you, and ${who} with you.`);
    if (s && !s.arrested) { s.arrested = endMs; p.assets = p.assets.filter(x => x !== s); }
  } else {
    const why = { bolted: `${cap(she)} ran, and you lost ${her}: alone in the city with ${her} face on every patrol's clipboard.`, lost: `You lost ${her} in the streets.`, stranded: `The car was gone by the time you got there. ${cap(she)}'s hidden for the night, and the night won't be enough.`,
      missed: `${cap(she)} waited on the bench, and nobody came.`, aborted: `You walked away from the bench. ${cap(she)} waited, and went home, and they were waiting there.` }[o] ?? 'It didn\'t happen.';
    (c.after ??= []).push(...taken(c, a, endMs + 10 * HOUR, linked, why));
    lines.push(why, linked ? 'And they saw your face beside theirs: heat up, a lot.' : `By the morning they'll have ${her}. The ${p.level === 'illegal' ? 'Center' : 'station'} will want to know why.`);
  }
  return { title: `${MISSIONS[a.kind].name.toUpperCase()}: ${who.toUpperCase()}` };
}

// ---------- the debug start ----------

/**
 * A deep campaign made up for an extraction (?mission=extraction, src/main.js): `level` at `city` from `seed`, an asset
 * compromised (or a colleague: who 'colleague'), the word read; at 'scene' its scene's context to begin at once (you a little
 * way from the bench, at its hour), at 'hub' the hub the morning the word's read, the day and a half to prepare. kit: disguise
 * kit uses in your pocket; face: the disguise officer's face for them waiting at the first safe house. Returns { campaign, a }.
 * make: the campaign's own maker (sim/campaign.js candidates + newCampaign), passed in so this module needn't import it.
 */
export function debugMission({ seed = 7, city = 'moscow', level = 'undercover', who = 'asset', at: when = 'scene', kit = 0, face = false } = {}, make) {
  const c = make(seed, city, level), p = c.posting;
  const day0 = dayOf(p.startMs) + FIRST_DAYS + 1;                  // (the week after it started: past the first days)
  c.now = day0 * DAY + 20 * HOUR;
  for (const k of c.calls ?? []) k.done = c.now;
  c.briefed = true;
  c.assignments = c.assignments.filter(x => dayOf(x.from) < day0);  // (the evening's own business set aside)
  const s = who === 'asset' ? (p.assets[0] ? Object.assign(p.assets[0], { burned: true }) : null) : null;
  const a = task(c, 'extract', s, c.now);
  if (!a) return { campaign: c, a: null };
  opened(c, a.id, a.word.from);
  c.signals = (c.signals ?? []).filter(x => x.mission !== a.id);
  if (kit) c.character.equip = { ...(c.character.equip ?? {}), disguise: kit };
  if (face) { const h = p.safehouses.find(x => !x.burned); if (h) h.disguises = [...(h.disguises ?? []), { id: `guest${a.id}`, look: a.mission.companion.sex === 'm' ? 'other' : 'older', q: 0.62, for: a.id }]; }
  if (when === 'hub') { c.now = a.word.from + 2 * HOUR; c.where = null; c.awake = c.now - 3 * HOUR; return { campaign: c, a }; }
  // (at the bench's street, a block off, its hour)
  const at = missionPlace(c, a);
  a.me = { x: at.x + (at.x > 40 ? -24 : 24), z: -2.6 };
  a.began = a.from - 4 * MIN;
  c.now = a.began; c.awake = c.now - 10 * HOUR;
  return { campaign: c, a };
}
