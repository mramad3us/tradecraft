// TRADECRAFT sim: the station's files (the user, 2026-10-29, on a tail's brief: "are all tails reading like
// this ?? … there should be insane variety in mission descriptions and specifics"). Who the posting's
// targets are, the men they meet, the assets; and an assignment's brief, written from them, its place,
// its hour, its light and weather, and the posting's heat: no two alike, and every fact in it the
// scene's own.
//
// **A target's file** (fileOf(), filled in once and kept on him): his age; what he is and his cover by the
// city (ROLES: a GRU colonel in a defence plant's procurement office in Moscow, the TASS correspondent of
// London's residency, a money-changer of Hezbollah's in Beirut …), the place he works (its words; its
// door is sim/places.js officeOf()); his tradecraft (CRAFT: careless, trained, sharp or jumpy: his
// Pathfinding and Awareness, how roundabout his way and how often he checks, in sim/scenarios/tail.js);
// his look, a man of his city's with something to know him by (sigOf(): a coat's colour, a hat or his
// hair, a briefcase or a newspaper, glasses, a beard); and the man he meets (his contact's look, the
// same man on the bench and outside the café: t.meets; t.contact is the campaign's count of his meetings
// seen). A name for a new one by his city (an Egyptian in Cairo,
// a Russian in London's residency).
// **An asset's file**: how long ours, what he brings (by the posting's subject), the sign he carries.
// **A brief** (briefOf()): paragraphs drawn from pools by the assignment's own dice (who, why, how to know
// him, his craft and the rule, the place and the hour with its light and weather, the opposition at this
// heat, a word to end on), each pool several ways of saying it and each saying full of the file's facts.
// **His lookalikes** (twinsOf(): the tail's men who could be him from a few paces) come from his look,
// each with the one thing that gives it away up close.
import { stream, int, pick, chance, weighted } from './rng.js';
import { cityById, townOf } from './cities/index.js';
import { streetLook, describe, colourName, topWord } from './people.js';
import { clockText } from './clock.js';
import { weather } from './weather.js';
import { sun } from './light.js';
import { missionPlace } from './places.js';
import { network } from './transit.js';

const CITY_NAME = { moscow: 'Moscow', london: 'London', beirut: 'Beirut', cairo: 'Cairo' };
const SERVICE = { moscow: 'The FSB', london: 'The residency', beirut: 'Hezbollah\'s security', cairo: 'The GIS' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// (a place's words mid-sentence: "the trade delegation on Sretenka", but "Pavel Rudnev's office" as it is)
const low = (s) => (/^(The|A|An|His|Outside) /.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const an = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;

// ---------- who they are ----------

// What a target is, his cover, where he works, how careful (weights over CRAFT), his age's range: by city.
const ROLES = {
  moscow: [
    ['a GRU officer, twenty years in', 'deputy head of procurement at a defence plant', 'the plant\'s city office', { trained: 3, sharp: 2, jumpy: 1 }, [46, 60]],
    ['an FSB officer of the Fifth Service', 'a consultant to a state energy firm', 'the energy firm\'s offices', { sharp: 3, trained: 2 }, [38, 55]],
    ['an SVR officer home between postings', 'a lecturer at the Diplomatic Academy', 'the Academy\'s annexe', { trained: 3, sharp: 1, careless: 1 }, [40, 58]],
    ['a missile engineer the GRU keeps close', 'a section head at a design bureau', 'the design bureau', { careless: 3, jumpy: 2 }, [35, 62]],
    ['a banker who moves the Kremlin\'s circle\'s money', 'a vice-president of a private bank', 'the bank', { careless: 2, jumpy: 2, trained: 1 }, [34, 52]],
    ['a colonel on the General Staff', 'a staff officer at the Defence Ministry', 'a Defence Ministry annexe', { trained: 2, careless: 2 }, [44, 58]],
    ['a freight forwarder the GRU uses for sanctioned parts', 'the director of a logistics firm', 'the logistics firm\'s office', { careless: 2, jumpy: 2 }, [36, 60]],
    ['a former KGB man who sells what he hears', 'a security consultant', 'a consultancy over a bank', { sharp: 2, trained: 2 }, [55, 68]],
  ],
  london: [
    ['an SVR officer of the residency', 'Third Secretary in the consular section', 'the consulate\'s annexe', { trained: 3, sharp: 1 }, [32, 48]],
    ['a GRU officer under a journalist\'s cover', 'TASS\'s London correspondent', 'the TASS bureau', { trained: 2, sharp: 2 }, [35, 52]],
    ['the residency\'s man at the trade delegation', 'a trade representative', 'the trade delegation', { trained: 2, careless: 1 }, [40, 58]],
    ['an SVR officer who runs émigrés', 'a cultural attaché', 'the Russian cultural centre', { trained: 2, jumpy: 1 }, [38, 55]],
    ['the residency\'s technical man', 'Aeroflot\'s station manager', 'the Aeroflot office', { careless: 1, trained: 2 }, [36, 50]],
    ['a GRU officer under business cover', 'a partner in a shipping-insurance firm', 'the insurers\' chambers', { sharp: 2, trained: 2 }, [40, 56]],
    ['an officer the station thinks supports an illegal', 'an attaché at the embassy\'s annexe', 'the embassy\'s annexe', { sharp: 3, jumpy: 1 }, [42, 60]],
  ],
  cairo: [
    ['a GIS colonel', 'a director at the Ministry of Military Production', 'the ministry\'s annexe', { trained: 2, sharp: 2 }, [45, 60]],
    ['an arms broker who sells to anyone', 'the owner of an import-export firm', 'the import-export firm\'s office', { careless: 2, jumpy: 2 }, [38, 64]],
    ['a GIS officer who handles the Russians', 'a deputy director of a state tourism company', 'the tourism company\'s offices', { trained: 3 }, [36, 52]],
    ['a fixer for the Sinai networks', 'a lawyer', 'his chambers', { jumpy: 3, careless: 1 }, [30, 50]],
    ['a courier the station thinks runs cash to Sinai', 'a clerk at a money-transfer office', 'the money-transfer office', { careless: 2, jumpy: 2 }, [24, 40]],
    ['an army procurement officer with a second income', 'a brigadier at a procurement directorate', 'the procurement directorate', { careless: 2, trained: 1 }, [48, 60]],
  ],
  beirut: [
    ['Hezbollah\'s security man at the port', 'a clearing agent', 'a clearing agent\'s office', { sharp: 2, jumpy: 2 }, [34, 52]],
    ['an IRGC liaison officer', 'an attaché at an Iranian cultural centre', 'the cultural centre', { sharp: 3, trained: 1 }, [36, 54]],
    ['a money-changer who moves Hezbollah\'s cash', 'the owner of an exchange office', 'his exchange office', { careless: 2, jumpy: 1 }, [40, 66]],
    ['a Syrian intelligence officer who stayed on', 'a partner in a trading company', 'the trading company', { trained: 2, sharp: 2 }, [45, 62]],
    ['a courier for the men who hold the hostages', 'a delivery driver', 'a dispatch office', { jumpy: 3, careless: 1 }, [22, 38]],
    ['a lawyer who carries their messages', 'a lawyer', 'his chambers', { trained: 2, jumpy: 2 }, [38, 60]],
  ],
};

/** What a new posting's assets are, by city (each its own reason to know what it knows). */
export const ASSET_ROLES = {
  moscow: ['a cipher clerk at the Foreign Ministry', 'a logistics officer at a defence plant', 'a secretary in the Presidential Administration', 'a programmer at a state telecoms firm',
    'a defence engineer', 'a customs officer at Sheremetyevo', 'a translator at a state firm', 'a junior officer in the General Staff\'s archive', 'a banker\'s assistant', 'a journalist on a state daily'],
  london: ['a clerk at the Russian trade delegation', 'an oligarch\'s driver', 'a chauffeur at the Russian embassy', 'a translator the residency hires', 'a Russian banker\'s personal assistant',
    'a Russian journalist who has had enough', 'an émigré the residency leans on', 'a property agent who sells to Russians'],
  cairo: ['a clerk at the Ministry of Military Production', 'a customs officer at Alexandria', 'a journalist on a state daily', 'a translator at a Russian joint venture',
    'a junior officer at an army depot', 'a banker\'s assistant at a state bank', 'a driver at the Interior Ministry', 'an engineer at a military factory'],
  beirut: ['a clerk at the port\'s customs house', 'a driver for a firm close to the party', 'a nurse in a hospital in the southern suburbs', 'a journalist with sources in the party',
    'a money-changer in Hamra', 'a telecoms engineer', 'an officer in the army\'s intelligence directorate', 'a lawyer who hears things'],
};

/**
 * How careful a man is: his Pathfinding and Awareness (sim/skills.js), how roundabout his way (the
 * tail's planRoute() evasive), whether he walks it wary (more checks, sooner: sim/habits.js) and starts
 * the evening alert, and what the station says of it.
 */
export const CRAFT = {
  careless: { pathfinding: 6, awareness: 5, evasive: 1, wary: false, alert: 0 },
  trained: { pathfinding: 10, awareness: 8, evasive: 1, wary: false, alert: 0 },
  sharp: { pathfinding: 13, awareness: 11, evasive: 2, wary: true, alert: 0 },
  jumpy: { pathfinding: 9, awareness: 10, evasive: 4, wary: true, alert: 25 },
};
const CRAFT_WORDS = {
  careless: ['He\'s never been trained, and it shows: he walks like a man going home.', 'No training the station knows of. He looks back when something makes him, not before.',
    'An amateur. That makes him easier, and a mistake of yours the more stupid.', 'He\'s never had the course. He looks in shop windows for what\'s in them.'],
  trained: ['He had the course, years ago, and hasn\'t forgotten all of it.', 'Trained, and out of practice: he checks now and then, mostly at corners.',
    'He knows the drills: a look back at a corner, a shop window, a crossing he doesn\'t need.', 'He was taught to look, and he still does, when he remembers.'],
  sharp: ['He\'s good. He checks his back the way other men check the time.', 'Sharp, and current: he uses every window on the street, and the glass of every door.',
    'One of their best on the street. Give him nothing to see twice.', 'He was an instructor once. Assume he sees everything, and give him nothing worth seeing.'],
  jumpy: ['He\'s jumpy this week: he thinks he\'s been followed, and he may be right.', 'Something\'s spooked him lately. He\'ll check more often, and sooner.',
    'Word is he\'s been nervous since a colleague was sent home. Nervous men look back.', 'He\'s on edge: a man like that sees a tail in every shadow, and once in a while he\'s right.'],
};

// The words for a coat's colour that can stand for the man in a crowd.
const HATS = { fedora: 'fedora', cap: 'flat cap', beanie: 'beanie', skullcap: 'skullcap', peaked: 'peaked cap' };
const HAT_SHORT = { fedora: 'fedora', cap: 'cap', beanie: 'beanie', skullcap: 'skullcap', peaked: 'cap' };

/**
 * What to know him by: { coat ('navy coat'), coats (plural), hat ('black fedora', or his hair: 'bald
 * head'), hatShort ('fedora'), carry ('briefcase', 'newspaper'), extra ('glasses', 'a beard'), line
 * ("Navy coat, black fedora, a briefcase.") }.
 */
export function sigOf(look, sex = 'm') {
  const coat = `${colourName(look.top?.color)} ${topWord(look.top?.kind)}`;
  const hair = look.hair?.style === 'bald' || look.hair?.style === 'shaved' ? 'bald head' : `${colourName(look.hair?.color) === 'pale grey' || colourName(look.hair?.color) === 'white' ? 'white' : colourName(look.hair?.color) === 'grey' ? 'grey' : 'dark'} hair`;
  const hat = look.hat ? `${colourName(look.hat.color)} ${HATS[look.hat.kind] ?? look.hat.kind}` : hair;
  const hatShort = look.hat ? HAT_SHORT[look.hat.kind] ?? look.hat.kind : hair;
  const carry = look.carry === 'briefcase' ? 'briefcase' : look.carry ? 'newspaper' : look.glasses ? 'glasses' : look.beard ? 'beard' : 'walk';
  const extra = [look.glasses === 'specs' ? 'glasses' : look.glasses === 'shades' ? 'dark glasses' : null, look.beard ? 'a beard' : look.moustache ? 'a moustache' : null].filter(Boolean);
  const things = [cap(coat), hat, look.carry ? an(carry) : null, ...extra].filter(Boolean);
  return { coat, coats: `${coat}s`, hat, hatShort, carry, extra, line: `${things.join(', ')}.`, man: describe(look, sex) };
}

/** A target's file, filled in the first time (and kept): see the header. city: his (a trip's, or the posting's). */
export function fileOf(c, t, city = c.posting.city) {
  if (t.file) return t;
  t.id ??= 'trip-target';
  const r = stream('dossier', c.seed, t.id, city), roles = ROLES[city] ?? ROLES.moscow;
  const [what, cover, workplace, crafts, [a0, a1]] = pick(r, roles);
  const age = a0 + int(r, a1 - a0 + 1), craft = weighted(r, Object.entries(crafts));
  // (his look: a man of his city's, and something to know him by: a hat or his hair, a briefcase or a
  // newspaper; a lead's, the face the photograph showed: sim/campaign.js fold())
  const look = t.look ? structuredClone(t.look) : cityById(city).people.look(r, 'm', age);
  dressed(look, city, r);
  if (!look.hat && chance(r, 0.5)) look.hat = { kind: weighted(r, [['fedora', age > 40 ? 3 : 0.5], ['cap', 2], ['beanie', 1.5], ...(city === 'cairo' || city === 'beirut' ? [['skullcap', 0.6]] : [])]), color: pick(r, [0x353947, 0x23252f, 0x47302a, 0x4c5262, 0x283f6b, 0x8f6345]) };
  if (look.hat?.kind === 'skullcap') look.hat.color = 0xf6f4ee;
  if (!look.carry) look.carry = weighted(r, [['briefcase', 3], ['paper', 2]]);
  delete look.rainwear;
  // (the man he meets: someone of the city, no one you'd look at twice, but for one thing)
  const cr = stream('dossier-contact', c.seed, t.id, city), cAge = 28 + int(cr, 35), cLook = dressed(cityById(city).people.look(cr, 'm', cAge), city, cr);
  if (!cLook.hat && chance(cr, 0.6)) cLook.hat = { kind: pick(cr, ['beanie', 'cap', 'fedora']), color: pick(cr, [0x283f6b, 0x9e3c36, 0x24503a, 0x353947, 0x8f6345, 0xd6ad7a]) };
  cLook.carry = chance(cr, 0.6) ? 'paper' : cLook.carry ?? null;
  Object.assign(t, { file: true, age, what: t.lead ? t.what : `${what}, under cover as ${cover}`, role: what, cover, workplace, craft, look, meets: { look: cLook, age: cAge } });
  return t;
}

/** Dressed for the street on business: a coat or a suit; in Cairo and Beirut a jumper or a galabeya will do. */
function dressed(look, city, r) {
  const warm = city === 'cairo' || city === 'beirut', kept = ['coat', 'suit', ...(warm ? ['robe', 'sweater'] : [])];
  if (!kept.includes(look.top?.kind)) look.top = { kind: warm && chance(r, 0.4) ? 'suit' : 'coat', color: pick(r, [0x353947, 0x4c5262, 0x23252f, 0x47302a, 0x8f6345, 0xd6ad7a, 0x24503a, 0x283f6b, 0x6e2a2e]), trim: 0x23252f };
  return look;
}

/** A name for a new target of a city's (a Russian of the residency's in London). */
export function targetName(r, city) {
  const [given, family] = cityById(city === 'london' ? 'moscow' : city).people.name(r, 'm', 45);
  return `${given} ${family}`;
}

/** An asset's file, filled in the first time: how long ours, what he brings, the sign he carries. */
export function assetFile(c, s, city = c.posting.city) {
  if (s.file) return s;
  const r = stream('dossier-asset', c.seed, s.codename, city);
  Object.assign(s, { file: true, months: 3 + int(r, 40) });
  return s;
}

// ---------- his lookalikes ----------

const NEAR = { 0x353947: 0x23252f, 0x23252f: 0x353947, 0x4c5262: 0x6a7182, 0x6a7182: 0x4c5262, 0x47302a: 0x6b4636, 0x6b4636: 0x47302a, 0x8f6345: 0xd6ad7a, 0xd6ad7a: 0x8f6345,
  0x24503a: 0x356f42, 0x283f6b: 0x1b2541, 0x6e2a2e: 0x9e3c36, 0x2f6b62: 0x24503a, 0x4a2a52: 0x6e2a2e };
/**
 * Men who could be him from a few paces off: his coat's colour and his hat, each differing in one thing
 * that gives him away up close: [[look, tell]] (the tell in the words you'd say to yourself).
 */
export function twinsOf(look, r) {
  const s = sigOf(look), base = () => structuredClone(look), out = [];
  { const l = base(); const other = look.carry === 'briefcase' ? 'paper' : look.carry ? 'briefcase' : 'paper'; l.carry = chance(r, 0.5) ? null : other; out.push([l, l.carry ? `${an(l.carry === 'briefcase' ? 'briefcase' : 'newspaper')}, not ${an(s.carry === 'walk' ? 'empty hand' : s.carry)}` : `no ${s.carry === 'walk' ? 'stoop' : s.carry}`]); }
  { const l = base(); l.top = { ...l.top, color: NEAR[look.top?.color] ?? 0x23252f }; l.hair = { ...l.hair, color: 0x47302a }; delete l.beard;
    const lum = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255), shade = colourName(l.top.color) !== colourName(look.top?.color) ? an(colourName(l.top.color)) : lum(l.top.color) < lum(look.top?.color ?? 0) ? 'a darker' : 'a lighter';
    out.push([l, `${shade} ${topWord(l.top.kind)}, and twenty years younger`]); }
  { const l = base(); const k = look.hat ? (look.hat.kind === 'fedora' ? 'cap' : 'fedora') : 'beanie'; l.hat = { kind: k, color: look.hat?.color ?? 0x353947 }; out.push([l, look.hat ? `${an(HAT_SHORT[k])}, not ${an(s.hatShort)}` : `${an(HAT_SHORT[k])} over his ${s.hat}`]); }
  { const l = base(); l.glasses = look.glasses ? null : 'specs'; if (!l.glasses) delete l.glasses; l.carry = look.carry === 'paper' ? 'briefcase' : 'paper'; out.push([l, `${look.glasses ? 'no glasses' : 'glasses'}, and ${an(l.carry === 'paper' ? 'newspaper' : 'briefcase')} where ${look.carry ? `the ${s.carry}` : 'nothing'} should be`]); }
  return out;
}

// ---------- the brief ----------

/** The light at a time in a city (the sun's, sim/light.js: the picture's own), in words; and the weather's, if it's anything. */
function lightOf(c, city, mapSeed, ms) {
  const elev = sun(ms, cityById(city).geo).elev;
  const light = elev > 6 ? pick(stream('light', ms), ['Broad daylight.', 'Daylight, and the street busy.', 'Daylight: you\'ll see him, and he\'ll see you.']) : elev > -3 ? pick(stream('light', ms), ['The light will be going.', 'Dusk, and the lamps coming on.', 'The light\'s on its way out by then.']) : pick(stream('light', ms), ['It\'ll be dark, and the lamps on.', 'Dark by then: the lamps, the shop windows, and the shadows between.', 'After dark. Faces are harder in lamplight, his and yours.']);
  let w = null;
  try { w = weather(townOf({ seed: mapSeed, city }), city, ms); } catch {}
  const wl = !w ? '' : w.kind === 'rain' ? ' Rain\'s forecast: umbrellas, and everyone looking at their feet.' : w.kind === 'snow' ? ' Snow on the way, and the pavements will be slow.' : w.kind === 'sleet' ? ' Sleet: nobody lingers anywhere.' : w.kind === 'fog' ? ' Fog: you\'ll need to be closer than you\'d like.' : w.kind === 'dust' ? ' A dusty wind: everyone squinting.' : '';
  return light + wl;
}

/**
 * A line from a pool, dealt: the same person's briefs take a pool's lines in a shuffled order of their
 * own (the n-th assignment of this kind for him, its n-th line), so none repeats till all have been said.
 */
function deal(c, a, key, list) {
  const seen = new Set([...c.assignments, ...c.done]), n = [...seen].filter(x => x.kind === a.kind && x.who === a.who && x.from < a.from).length;
  const r = stream('deal', c.seed, a.who, a.kind, key), order = list.map((_, k) => k);
  for (let k = order.length - 1; k > 0; k--) { const j = int(r, k + 1); [order[k], order[j]] = [order[j], order[k]]; }
  return list[order[n % list.length]];
}

/** An assignment's brief: { title, body: [paragraphs] } (the scene puts its footer and keys to it). */
export function briefOf(c, a) {
  const p = c.posting, T = a.trip ? p.trips?.find(t => t.id === a.who) : null, city = T?.city ?? p.city, cityName = CITY_NAME[city] ?? 'the city';
  const d = (key, list) => deal(c, a, key, list), at = missionPlace(c, a), mapSeed = T?.mapSeed ?? p.mapSeed;
  const when = clockText(a.from), until = clockText(a.to), light = lightOf(c, city, mapSeed, a.from), service = SERVICE[city] ?? 'They';
  const trip = T ? d('trip', [`${cityName}, with ${T.station}'s team, flown out this morning: ${T.why}.`, `A loan to ${T.station} for the evening, ${cityName}: ${T.why}.`, `${T.station} asked for you, or for someone like you: ${T.why}. ${cityName}, tonight.`]) : null;
  if (a.kind === 'tail' || a.kind === 'watch') {
    const t = fileOf(c, T ? T.target : p.targets.find(x => x.id === a.who), city);
    const s = sigOf(t.look), family = t.name.split(' ').slice(-1)[0], where = at ? at.label : cap(t.workplace), line = s.line.charAt(0).toLowerCase() + s.line.slice(1);
    const who = d('who', [`${t.name}, ${t.age}: ${t.role}, under cover as ${t.cover}.`, `${t.name}. ${cap(t.role)}; on paper, ${t.cover}. ${t.age} years old.`, `${t.name}, ${t.cover}, ${t.age}. In fact ${t.role}.`,
      `On the diplomatic list, or the company register, ${t.name} is ${t.cover}. The station has him as ${t.role}. He's ${t.age}.`]);
    const look = d('look', [`To know him by: ${line}`, `${s.line} Plenty of men in ${cityName} wear ${an(s.coat)}.`, `${s.line} Not a face you'd remember, which is rather the point.`,
      `Look for the ${s.hat} and the ${s.carry === 'walk' ? 'way he walks' : s.carry}: ${line}`, `${s.line} Easy to lose among the ${s.coats} at that hour.`]);
    const craft = d('craft', CRAFT_WORDS[t.craft]);
    if (a.kind === 'tail') {
      const why = d('why', [
        `Some days he leaves ${t.workplace} and walks somewhere he doesn't tell his wife about. The station would like to know where, and who's waiting.`,
        `Twice this month he's left ${t.workplace} on foot when he has a car and a driver. A man who walks when he could ride wants to be alone, or not to be.`,
        `A source says he meets someone every week or so, never on the telephone. Who that is matters for ${p.subject}.`,
        'The listening post caught half a sentence on his line: "the usual place, after work". Find the usual place, and whoever he meets there.',
        'He\'s due home next month. Whatever he\'s been running here, he\'ll be handing it over, and tonight could be the handover.',
        'He\'s been buying things he can\'t afford on what he\'s paid. Somebody\'s paying him the rest, and the station wants to see whom.',
        'He cried off a reception tonight with a headache. Headaches don\'t usually go for walks.',
        `His diary says nothing tonight. His secretary booked him a table for two, and cancelled it an hour later.`,
        `${cap(service.replace(/^The /, 'the '))} moved three of its people last week. He's the one who wasn't moved, and the station wants to know why.`,
        `A friendly service passed us a name, and his was next to it. Tonight we see if they're right.`,
      ]);
      const rule = d('rule', ['If he sees the same face twice, he\'ll go home, and we won\'t get this chance again.', 'Let him see you twice and it\'s over: he\'ll walk home, and the meeting won\'t happen for months.',
        'Two sightings and he calls it off. There won\'t be a third chance this year.', 'Once is a coincidence to a man like him. Twice is you, and he\'ll take you home with him instead of to his meeting.']);
      const place = d('place', [`He leaves ${low(where)} at ${when}. ${light}`, `${when}: ${low(where)}, his door. ${light}`, `He's out of his door at ${when}, give or take: ${low(where)}. ${light}`]);
      const go = d('go', ['Be across the street from his door before then, waiting for someone else. Then keep him in sight, keep people between you, keep his pace, and don\'t stop when he stops.',
        'Be there first, with a reason to be. After that it\'s your eyes: keep him in sight, keep people between you, and don\'t stop when he stops.',
        'Take up a post across from his door before he\'s out. Follow at his pace; let the street hide you; and lose him rather than be seen.',
        'Find a post with a reason in it: a bus stop, a kiosk, a shop window across the way. When he\'s out, give him a lead and keep it.']);
      return { title: `TAILING: ${t.name.toUpperCase()}`, body: [trip, who, why, `${look} ${craft}`, rule, place, go].filter(Boolean) };
    }
    // (a photograph: the man from the bench, if a tail saw him)
    const other = t.contact && t.meets?.look ? sigOf(t.meets.look) : null, word = at?.shop === 'bar' || at?.shop === 'pub' ? 'bar' : at?.shop === 'restaurant' ? 'restaurant' : 'café';
    const cafe = at ? low(at.label.replace(/^Outside /, '')) : 'a café';
    const meet = d('meet', [`${t.name} meets someone outside ${cafe}, between ${when} and ${until}, they think.`, `Between ${when} and ${until}, ${family} has a meeting outside ${cafe}. The station would like a picture of it.`, `Outside ${cafe}, between ${when} and ${until}: ${family}, and someone he meets there.`]);
    const them = other && !T ? d('them', [`The man he meets is the one from the bench: ${other.line.charAt(0).toLowerCase()}${other.line.slice(1)} Both faces, together.`, `Whom he meets, we half know: ${other.man}, the last time. A photograph puts a name to him.`])
      : d('them', ['Who he meets, nobody knows: that\'s what the photograph is for. Both faces, together.', 'The other man is the point. Both faces, in one frame.']);
    const minder = d('minder', [`He won't be alone. ${service} minds its people, and the minder will be looking at faces round the ${word} before ${family} comes.`, 'There\'ll be a minder: across the road, early, looking at everyone who stops. He\'s paid to be suspicious; give him nothing to be suspicious of.',
      `${service} doesn't let a man like ${family} meet anyone unwatched. Expect someone across the road, looking for people like you.`]);
    const how = d('how', ['Don\'t stand about in the open, don\'t stare, and don\'t let him see a camera. A shop window, a kiosk, a café\'s window across the way: reasons to be where you are.',
      'Have a reason to be where you are: a paper at a kiosk, a coffee at a window, a shop\'s glass. The camera comes out once, when both faces are there.', 'Get there early, find somewhere you belong, and let the minder look you over and lose interest. Then the camera.']);
    return { title: `A PHOTOGRAPH: ${t.name.toUpperCase()}`, body: [trip, `${meet} ${light}`, `${who} ${look}`, them, minder, how].filter(Boolean) };
  }
  // (an asset meeting)
  const s = T ? T.asset : p.assets.find(x => x.id === a.who);
  if (!T) assetFile(c, s, city);
  const sig = sigOf(s.look, s.sex), months = s.months ?? 6, since = months >= 24 ? `${Math.floor(months / 12)} years` : `${months} months`;
  const motive = { money: ['He wants it in dollars, and more of it each time.', 'He\'s in it for the money, and he\'s never pretended otherwise.', 'Bring the envelope. He counts it in front of you; let him.'],
    ideology: ['He thinks his country deserves better than the men who run it.', 'He does it because he believes it. Don\'t make him regret that.', 'He talks about his grandfather, and the camps. Listen.'],
    ego: ['He likes to be told he matters. Tell him.', 'He wants to be the man who changed things. Let him think he is.', 'He thinks he\'s cleverer than his bosses. He may be.'],
    revenge: ['He was passed over, and he hasn\'t forgiven them.', 'They wronged him once. He hasn\'t forgotten, and he wants them to know it, some day.', 'He hates his chief more than he loves his country. That\'s enough, for now.'] }[s.motive] ?? ['He\'s ours, for his own reasons.'];
  const who = T ? `${s.codename} is ${s.role}, one of ${T.station}'s; you've never met him, and he's never met you.` : d('who', [`${s.codename} is ${s.role}, ours for ${since}. ${d('motive', motive)}`, `${s.codename}: ${s.role}, ${since} on our books, in it for ${s.motive}. ${d('motive', motive)}`,
    `${d('motive', motive)} ${s.codename}, ${s.role}, has been ours ${since}.`]);
  const brings = d('brings', [`He has something on ${p.subject} that won't keep.`, 'He says he has documents. He always says that; sometimes he does.', `Photographs, he says: pages he shouldn't have been near. For ${p.subject}, it could matter.`,
    'A list of names, if he\'s brave enough to have brought it.', 'Nothing much tonight, he says. But a meeting kept is a network kept.', `Whatever he has on ${p.subject}, it's been a week coming.`,
    'He wants to talk more than he wants to hand anything over. Let him: that\'s the job too.', 'A memory stick, taped inside a cigarette packet. He\'ll leave the packet on the bench.']);
  const bench = at ? at.label.replace(/^A bench in /, '') : 'the boulevard', ride = network(townOf({ seed: mapSeed, city })).metro ? (city === 'london' ? 'the Underground' : 'the metro') : 'a service taxi';
  const meet = d('meet', [`Tonight he sits on a bench in ${bench}, from ${when} until ${until}. ${sig.line}`, `${when} to ${until}: a bench in ${bench}. ${sig.line}`, `He'll be on a bench in ${bench} from ${when}, and gone by ${until}. ${sig.line}`]);
  const heat = p.heat;
  const opp = d(`opp${heat >= 50 ? 2 : heat >= 30 ? 1 : 0}`, heat >= 50 ? [`${service} has been on you most days lately. Assume tonight they are.`, `You're hot. ${service} is more interested in your evenings than it was. Assume they're behind you.`, 'They know your face, your flat and your hours. Tonight, prove them wrong about one of those.']
    : heat >= 30 ? [`${service} follows embassy staff when it likes. Some evenings nobody; some evenings two of them, close, not caring if you see; some evenings a proper team you won't see unless you look.`, 'They\'ve had a look at you once or twice. Tonight, who knows: nobody, a pair who don\'t care if you see them, or a team that does.', 'You\'ve been noticed. Not watched, not yet: noticed. Act like a man with nothing to hide, and check like one who has.']
    : [`${service} follows embassy staff when it likes, and lately it hasn't much liked you. Check anyway.`, 'You\'ve been quiet. Quiet is good. Check anyway: some evenings there\'s a team you won\'t see unless you look.', 'Nobody\'s shown much interest in you. That\'s exactly when they start.']);
  const how = d('how', ['The walk there is the work: check your back the way people do, a shop window, a crossing, a reason to turn. If they\'re on you, lose them where they can\'t see you do it, or don\'t go.',
    `Take the long way: a shop with two doors, a bus, ${ride}. If anyone's still behind you at the end of it, he isn't a coincidence.`, 'Walking them to him ends him. Not sure? Walk past the bench and go home. He\'ll understand; they won\'t.',
    'Leave in good time and use it: a stop that isn\'t on the way, a train you get off before the doors close. Arrive clean or not at all.']);
  return { title: `MEETING: ${s.codename}`, body: [trip, who, `${meet} ${light}`, brings, opp, how].filter(Boolean) };
}
