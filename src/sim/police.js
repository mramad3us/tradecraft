// TRADECRAFT sim: ordinary law (DESIGN.md, Ordinary law: "Police patrol and react. A stop is a scene, Papers,
// Please-like: they read your papers, ask questions (Deception), and may search your pockets"; the
// mechanic tests' seventh, a police stop). The engine's, on the street, where the scene has it
// (scenario.police: the free walk, the campaign's own hours; not the mechanic tests, whose bots don't
// answer a policeman).
//
// **Patrols** (patrolTick()): a street has a pair walking it this hour or not (PATROL_P by city: Moscow's
// and Cairo's police are everywhere, London's seldom on foot), the hour's dice. The pair starts at the
// far end of the stretch in play and walks its pavement past you, in uniform (LOOK by city), and goes.
// **What draws them** (eyeTick()): an officer with you in sight within EYE_M weighs you once, and again
// if more shows: what shows (sim/notice.js mods(): blood, something in your hand, at your belt, a bulge,
// a sneeze), STOP_PER_POINT a point, with the city's habit of asking foreigners for their papers (BASE)
// and how hot you are (heat over HEAT_FROM, a point every HEAT_PER): the chance they stop you.
// **The stop**: they come up to you, the pair, and ask for your documents. The UI's card (the bus:
// 'police') offers the ways (ways()); walking off STOP_M before you answer is walking away.
//   - **Your papers**: official cover is a diplomatic passport. Handed back, with a look; your name in a
//     notebook (+PAPERS_HEAT). Blood showing, or a weapon, and they search anyway.
//   - **Their questions**: your Deception against their Awareness (blood showing −4, something in your
//     hand −3): made, a nod and you're on your way, nothing written; missed, they search you.
//   - **Walk away**: a diplomat may (immunity), and the embassy hears of it (+WALK_HEAT, cover standing
//     −WALK_COVER in the campaign).
//   - **Searched**: what shows is found; what's in a pocket, their Awareness against your Deception
//     (+POCKET_MOD). A weapon found on a diplomat is taken, and reported (+FOUND_HEAT, cover standing
//     −FOUND_COVER: the ambassador hears). Nothing found: on your way, written down.
// Officers' sheets are cops' (sim/skills.js): Awareness by the city's force (SKILL).
import { makeAgent, setRoute } from './agents.js';
import { townOf } from './cities/index.js';
import { LINE, routeFrom } from './city.js';
import { sheet } from './people.js';
import { stream, chance, pick } from './rng.js';
import { seesActor } from './perception.js';
import { mods as shows } from './notice.js';
import { opposed } from './checks.js';
import { skill } from './skills.js';
import { addHeat, heat } from './heat.js';
import { say } from './log.js';
import { placed } from './items.js';
import { weaponOf } from './weapons.js';
import { HOUR } from './clock.js';

export const PATROL_P = { moscow: 0.45, cairo: 0.4, beirut: 0.3, london: 0.12 };
export const BASE = { moscow: 0.06, cairo: 0.04, beirut: 0.03, london: 0.004 };
export const SKILL = { moscow: 9, cairo: 7, beirut: 7, london: 10 };
export const EYE_M = 14, STOP_M = 6, STOP_PER_POINT = 0.07, HEAT_FROM = 30, HEAT_PER = 400, SPAWN_M = 70, GONE_M = 110;
export const PAPERS_HEAT = 2, WALK_HEAT = 4, WALK_COVER = 3, FOUND_HEAT = 10, FOUND_COVER = 12, POCKET_MOD = 2, BLOOD_MOD = -4, HELD_MOD = -3;
const LOOK = {
  london: { top: { kind: 'uniform', color: 0x23252f, trim: 0xd6e04a }, legs: 0x23252f, hat: { kind: 'peaked', color: 0x14151c, band: 0xf6f4ee } },
  moscow: { top: { kind: 'uniform', color: 0x4c5262, trim: 0x9e3c36 }, legs: 0x353947, hat: { kind: 'peaked', color: 0x4c5262, band: 0x9e3c36 } },
  cairo: { top: { kind: 'uniform', color: 0xe6e2d8, trim: 0x14151c }, legs: 0x14151c, hat: { kind: 'peaked', color: 0x14151c, band: 0x14151c } },
  beirut: { top: { kind: 'uniform', color: 0x3b4a5e, trim: 0xb9862e }, legs: 0x3b4a5e, hat: { kind: 'peaked', color: 0x3b4a5e, band: 0xb9862e } },
};
const ASK = { london: '"Excuse me. Can I see some identification, please?"', moscow: '"Документы, пожалуйста." Documents, please.', cairo: '"Your passport, please."', beirut: '"Your papers?"' };

const cityOf = (state) => state.map.city ?? 'moscow';
const cops = (state) => state.actors.filter(a => a.cop);
const playerOf = (state) => state.actors.find(a => a.who === state.player);

/** Once a second: a patrol on this street this hour, or not; walking past; gone when it's past. */
export function patrolTick(state) {
  const me = playerOf(state);
  if (!me || state.map.kind !== 'street') return;
  const row = state.map.row ?? 0, hour = Math.floor(state.time.ms / HOUR), city = cityOf(state);
  for (const a of cops(state)) {
    const done = !a.ai.route || a.ai.s >= a.ai.route.length - 0.05;
    if ((a.row ?? row) !== row || Math.abs(a.x - me.x) > GONE_M || (done && !a.stopping)) { state.actors.splice(state.actors.indexOf(a), 1); delete state.people[a.who]; }
  }
  if (cops(state).length) return;
  const r = stream('patrol', state.map.seed, row, hour);
  if (!chance(r, PATROL_P[city] ?? 0.3) || state.flags.patrol === `${row}|${hour}`) return;
  state.flags.patrol = `${row}|${hour}`;                           // (this street's patrol this hour has been: not again)
  // (from the far end of the stretch in play, past you, along a pavement: two, a pace apart)
  const dir = chance(r, 0.5) ? 1 : -1, z = chance(r, 0.5) ? LINE.N : LINE.F, x0 = me.x - dir * SPAWN_M, town = townOf(state.map);
  for (let k = 0; k < 2; k++) {
    const who = `cop${hour % 1000}${k}`, sex = chance(r, 0.25) ? 'f' : 'm';
    state.people[who] = sheet({ id: who, name: 'a police officer', sex, cls: 'cop', skills: { awareness: [SKILL[city] ?? 8, 0], cqc: [6, 0], tracking: [6, 0] },
      look: { skin: pick(r, city === 'london' ? ['light', 'tan', 'brown', 'dark'] : city === 'moscow' ? ['light'] : ['tan', 'brown']), hair: { style: 'crew', color: pick(r, [0x23252f, 0x47302a]) }, shoes: 0x14151c, ...structuredClone(LOOK[city] ?? LOOK.moscow) } });
    const a = makeAgent(state, { who, row, x: x0 - dir * k * 1.3, z: z + k * 0.4, speed: 1.15, face: dir > 0 ? 'right' : 'left' });
    a.cop = true;
    try { setRoute(state, a, routeFrom(town, { row, x: a.x, z: a.z }, { row, x: me.x + dir * (SPAWN_M + 20), z: a.z })); } catch { a.ai.route = null; }
  }
}

/** The chance an officer stops you, now: what shows, the city's habit, your heat. */
export function stopChance(state) {
  const p = state.people[state.player], pts = shows(p).reduce((s, m) => s + m.v, 0);
  return Math.min(0.95, (BASE[cityOf(state)] ?? 0.03) + pts * STOP_PER_POINT + Math.max(0, heat(state) - HEAT_FROM) / HEAT_PER);
}

/** Once a second: officers who see you weigh you; a stop begun walks up to you and asks; walked off from, you've walked away. */
export function eyeTick(state, bus) {
  const me = playerOf(state), S = state.$stop;
  if (!me || me.hidden || state.fight || state.map.kind !== 'street') return;
  if (S) {
    const lead = state.actors.find(a => a.id === S.lead);
    if (!lead) { delete state.$stop; return; }
    const d = Math.hypot(lead.x - me.x, lead.z - me.z);
    if (!S.asked) {
      for (const a of cops(state)) { a.stopping = true; try { setRoute(state, a, routeFrom(townOf(state.map), { row: state.map.row ?? 0, x: a.x, z: a.z }, { row: state.map.row ?? 0, x: me.x + (a.id === S.lead ? 0.9 : -0.9), z: me.z })); } catch {} }
      if (d < 1.8) { S.asked = state.time.ms; S.at = { x: me.x, z: me.z }; say(state, bus, { kind: 'note', text: `Two police officers, and one of them's in your way. ${ASK[cityOf(state)] ?? ASK.moscow}` }); bus?.emit('police', { line: 'DOCUMENTS', ways: ways(state) }); }
      else if (d > EYE_M * 2) { delete state.$stop; for (const a of cops(state)) a.stopping = false; }
    } else if (Math.hypot(me.x - S.at.x, me.z - S.at.z) > STOP_M) answer(state, bus, 'walk');
    else if (state.time.ms - (S.again ?? S.asked) > 6000) { S.again = state.time.ms; bus?.emit('police', { line: 'DOCUMENTS', ways: ways(state) }); }   // (the card shut without an answer: asked again)
    return;
  }
  const odds = stopChance(state);
  for (const a of cops(state)) {
    if (a.done || (a.weighed ?? -1) >= odds || Math.hypot(a.x - me.x, a.z - me.z) > EYE_M || !seesActor(state, a, me)) continue;
    a.weighed = odds;
    if (chance(stream('stop', state.map.seed, a.id, Math.floor(state.time.ms / 1000)), odds)) { state.$stop = { lead: a.id }; return; }
  }
}

/** What you can do, stopped: [{ key, label }]. */
export function ways(state) {
  const official = state.legend?.cover === 'official';
  return [
    { key: 'papers', label: official ? 'Show your diplomatic passport' : 'Show your papers' },
    { key: 'talk', label: 'Answer their questions, easy and dull (Deception)' },
    ...(official ? [{ key: 'walk', label: 'Walk on: you\'re a diplomat (the embassy will hear of it)' }] : []),
  ];
}

/** Your answer to the stop: what they do. */
export function answer(state, bus, key) {
  const S = state.$stop, me = playerOf(state), p = state.people[state.player];
  if (!S?.asked || !me) return;
  const lead = state.actors.find(a => a.id === S.lead), them = lead && state.people[lead.who], c = state.campaign, s = shows(p);
  const blood = s.some(m => /blood/.test(m.why)), held = s.some(m => /hand/.test(m.why));
  const end = (text, dHeat = 0, dCover = 0) => {
    if (dHeat) addHeat(state, dHeat);
    if (dCover && c) c.posting.cover = Math.max(0, c.posting.cover - dCover);
    say(state, bus, { kind: 'note', text });
    delete state.$stop;
    for (const a of cops(state)) { a.done = true; a.stopping = false; try { setRoute(state, a, routeFrom(townOf(state.map), { row: state.map.row ?? 0, x: a.x, z: a.z }, { row: state.map.row ?? 0, x: a.x + (a.face === 'left' ? -GONE_M : GONE_M), z: a.z })); } catch {} }
  };
  if (key === 'walk') return end('You don\'t stop: a diplomat needn\'t. One of them talks into his radio as you go. The embassy will hear of it by tonight.', WALK_HEAT, WALK_COVER);
  if (key === 'talk') {
    const r = opposed(state.rng, { skill: 'deception', value: skill(p, 'deception'), body: p, mods: [blood && { why: 'blood on you', v: BLOOD_MOD }, held && { why: 'something in your hand', v: HELD_MOD }].filter(Boolean) },
      { skill: 'awareness', value: skill(them, 'awareness'), body: them });
    say(state, bus, { kind: 'roll', roll: r, text: r.ok ? 'Where you\'re going, where you\'ve been: the dull truth, or near enough. A nod. On your way.' : 'Your answers come a beat too smooth, and he\'s heard smooth before. "Turn out your pockets."' });
    if (r.ok) return end('They walk on.');
    return search(state, bus, them, end);
  }
  // (papers: a diplomat's, handed back; what shows gets a search anyway)
  say(state, bus, { kind: 'note', text: state.legend?.cover === 'official' ? 'He turns the diplomatic passport over, reads it twice, writes your name in his notebook, and hands it back.' : 'He reads your papers slowly, and looks at you over them.' });
  if (blood || held) return search(state, bus, them, end, 'The blood on you, the thing in your hand: "And your pockets, please."');
  return end('"Thank you." They walk on.', PAPERS_HEAT);
}

/** A search: what shows is found, what's in a pocket by their Awareness against your Deception. */
function search(state, bus, them, end, why = null) {
  const p = state.people[state.player], found = [];
  if (why) say(state, bus, { kind: 'note', text: why });
  if (p.hand && weaponOf(p.hand)) found.push(p.hand);
  for (const o of placed(p).out) {
    if (!weaponOf(o.kind)) continue;
    if (o.shows) { found.push(o.kind); continue; }
    const r = opposed(state.rng, { skill: 'awareness', value: skill(them, 'awareness'), body: them }, { skill: 'deception', value: skill(p, 'deception'), body: p, mods: [{ why: 'in a pocket', v: POCKET_MOD }] });
    if (r.ok) found.push(o.kind);
  }
  if (!found.length) return end('Hands down your coat, your pockets turned out: keys, a phone, coins. Nothing. "On your way." Your name\'s in the notebook.', PAPERS_HEAT);
  // (taken; a diplomat isn't arrested: driven to the embassy's gate)
  for (const k of found) { if (p.hand === k) delete p.hand; else { const i = (p.items ?? []).indexOf(k); if (i >= 0) p.items.splice(i, 1); } }
  const words = found.map(k => weaponOf(k).name);
  return end(`They find ${words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]}, and take ${found.length > 1 ? 'them' : 'it'}. Your name, a long look, a radio call: a diplomat isn't arrested, only reported. The ambassador will hear of it before the day's out.`, FOUND_HEAT, FOUND_COVER);
}

