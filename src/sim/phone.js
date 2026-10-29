// TRADECRAFT sim: calling your network (the user, 2026-10-28: "start working on mobile phones, both
// smartphones and burners"; DESIGN.md, Telephones: what the burners are for, the network's calls).
//
// A call to one of your assets (the mind's People leaf: src/ui/mind.js), for one of WHY:
//   - **forward**: the next meeting brought forward, to tomorrow evening (or the first free evening after:
//     one a day, as the planner keeps them: sim/campaign.js plan()); none planned, one made;
//   - **off**: the next meeting put off OFF_DAYS (you're hot, or it's a bad week);
//   - **word**: a word, to keep them warm: trust +1, once in WARM_DAYS (a voice on the line is what keeps
//     an agent yours between meetings).
// From a **burner** (sim/clothes.js: bought at a phone shop, counted on p.burners): used once and dumped,
// the SIM snapped, the phone in a bin; nothing to trace. From **your own phone**: the embassy's
// officer's number on the asset's bill. The opposition reads such things: OWN_HEAT on you, and with a
// chance by how much they're on you already (heat / OWN_BURN_HEAT), they look at who you rang: the asset
// compromised (sim/campaign.js pass(): each day after, they may be arrested). A compromised asset's own
// line is watched: from your own phone to theirs, they're as good as gone (OWN_BURNED_HEAT on you).
// The call takes CALL_S, head bowed over the phone (the sprites' 'phone' pose), on the street.
import { stream, chance, range } from './rng.js';
import { DAY, MIN, calendar, clockText, WEEKDAYS } from './clock.js';
import { say } from './log.js';
import { addHeat } from './heat.js';

export const CALL_S = 40, OFF_DAYS = 3, WARM_DAYS = 3, OWN_HEAT = 4, OWN_BURN_HEAT = 200, OWN_BURNED_HEAT = 10, TRUST_MAX = 5;
export const WHY = { forward: 'Bring the next meeting forward', off: 'Put the next meeting off', word: 'A word, to keep them warm' };
const hm = clockText;
const dayOf = (ms) => Math.floor(ms / DAY);
const workday = (ms) => calendar(ms).weekday < 5;

/** The asset's next meeting still to come (open), or null. */
export const nextMeeting = (c, id, now) => c.assignments.filter(a => a.status === 'open' && a.kind === 'sdr' && a.who === id && !a.trip && a.to > now).sort((a, b) => a.from - b.from)[0] ?? null;

/** What a call to asset s could be for, now: [{ key, label, ok, why }]. */
export function callWays(c, s, now) {
  const m = nextMeeting(c, s.id, now), tomorrow = dayOf(now) + 1;
  return [
    { key: 'forward', label: WHY.forward, ok: !m || dayOf(m.from) > tomorrow, why: m ? (dayOf(m.from) > tomorrow ? `${dayText(m.from, now)} at ${hm(m.from)}, to tomorrow evening (or the first free one)` : `it's ${dayText(m.from, now)} already`) : 'none planned: one tomorrow evening' },
    { key: 'off', label: WHY.off, ok: !!m, why: m ? `${dayText(m.from, now)} at ${hm(m.from)}, put off ${OFF_DAYS} days` : 'none planned' },
    { key: 'word', label: WHY.word, ok: !(s.word > now - WARM_DAYS * DAY), why: s.word > now - WARM_DAYS * DAY ? 'you rang them lately' : `trust ${Math.min(TRUST_MAX, s.trust + 1) > s.trust ? 'up' : 'kept'}` },
  ];
}
/** A day, as said on the phone: 'today', 'tomorrow', 'Thursday'. */
const dayText = (ms, now) => ['today', 'tomorrow'][dayOf(ms) - dayOf(now)] ?? WEEKDAYS[calendar(ms).weekday];

/**
 * The call, made: asset id, phone ('burner' | 'own'), why (callWays()). The burner spent or the risk taken;
 * the meeting moved, or the word had; the line in the log. Returns { ok, text }.
 */
export function call(state, bus, id, phone, why) {
  const c = state.campaign, p = state.people[state.player], s = c?.posting.assets.find(a => a.id === id), now = state.time.ms;
  if (!s) return { ok: false };
  if (phone === 'burner' && !(p.burners > 0)) return { ok: false, text: 'No burner on you: a phone shop sells them.' };
  const way = callWays(c, s, now).find(w => w.key === why);
  if (!way?.ok) return { ok: false, text: way?.why };
  const lines = [];
  if (phone === 'burner') {
    p.burners--; if (!p.burners) delete p.burners;
    lines.push('A burner, a number from memory.');
  } else {
    lines.push('Your own phone: the embassy\'s Second Secretary, on their bill.');
    const r = stream('call', c.seed, id, Math.floor(now / MIN));
    if (s.burned) { addHeat(state, OWN_BURNED_HEAT); lines.push('Their line\'s watched: whoever listens heard you.'); }
    else { addHeat(state, OWN_HEAT); if (chance(r, (c.posting.heat ?? 0) / OWN_BURN_HEAT)) { s.burned = now; s.burnedBy = 'call'; } }
  }
  if (why === 'word') {
    s.word = now; s.trust = Math.min(TRUST_MAX, s.trust + 1);
    lines.push(`${s.codename} picks up on the fourth ring. Nothing that matters is said, which is the point: a few minutes about the weather, the price of things. They sound glad of it.`);
  } else {
    const m = nextMeeting(c, s.id, now);
    const day = why === 'forward' ? freeDay(c, dayOf(now) + 1, m) : freeDay(c, dayOf(m.from) + OFF_DAYS, m);
    const from = eveningOf(c, day, s.id);
    if (m) Object.assign(m, { from, to: from + 15 * MIN, start: from - 30 * MIN, brief: m.brief.replace(/between \d\d:\d\d and \d\d:\d\d/, `between ${hm(from)} and ${hm(from + 15 * MIN)}`), moved: now });
    else c.assignments.push({ id: `a${(Math.floor(now / MIN) * 31 + s.id.length) % 1e7}`, kind: 'sdr', who: s.id, from, to: from + 15 * MIN, start: from - 30 * MIN, status: 'open', moved: now,
      brief: `Meet ${s.codename} (${s.role}) on a boulevard bench, between ${hm(from)} and ${hm(from + 15 * MIN)}. Clean, or not at all.` });
    if (why === 'off') s.nextDay = Math.max(s.nextDay ?? 0, day + 2);
    lines.push(`${s.codename} answers, and you say the words you agreed: ${why === 'forward' ? 'sooner' : 'later'}. The bench, ${dayText(day * DAY, now)}, between ${hm(from)} and ${hm(from + 15 * MIN)}.`);
  }
  if (phone === 'burner') lines.push('The SIM snapped, the phone in a bin two streets on.');
  const text = lines.join(' ');
  say(state, bus, { kind: 'note', text });
  const me = state.actors.find(a => a.who === state.player);
  if (me && !state.fight) { me.busy = { what: 'call', steps: [['wait', Math.round(CALL_S * 20), me.face, 'phone']], wait: 0, since: now }; me.vx = me.vz = 0; }
  return { ok: true, text };
}

/** The first day from d with no assignment on it (one a day), the meeting being moved not counted. */
function freeDay(c, d, m) {
  for (let k = 0; k < 14; k++) if (!c.assignments.some(a => a !== m && a.status === 'open' && dayOf(a.from) === d + k)) return d + k;
  return d;
}
/** An evening's hour on day d, the planner's window (a working day's 18:30–20:30, a weekend's 14:00–19:00). */
function eveningOf(c, d, id) {
  const r = stream('callplan', c.seed, d, id), [h0, h1] = workday(d * DAY) ? [18.5, 20.5] : [14, 19];
  return d * DAY + Math.round(range(r, h0, h1) * 60) * MIN;
}

