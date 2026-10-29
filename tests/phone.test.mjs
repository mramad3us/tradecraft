// Calling your network (sim/phone.js): a meeting brought forward to tomorrow, or put off; a word that warms
// an asset, not again for days; a burner spent, nothing traced; your own phone traced, and the hotter you
// are, the likelier they look at who you rang.
import { newGame, start, step } from '../src/sim/game.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { call, callWays, nextMeeting, OWN_HEAT } from '../src/sim/phone.js';
import { createBus } from '../src/sim/bus.js';
import { heat } from '../src/sim/heat.js';
import { DAY, MIN, dateText, clockText } from '../src/sim/clock.js';
import { assert } from './helpers.mjs';

const hub = (seed) => {
  const c = newCampaign(seed, candidates(seed, 'moscow', 'handler')[0], 'moscow', 'handler');
  c.calls = [];
  const s = newGame({ seed, scenario: 'campaign', campaign: c }), bus = createBus();
  start(s, bus);
  return { s, c, bus };
};
const day = (ms) => Math.floor(ms / DAY);

export default [
  {
    name: 'phone: brought forward only to a free evening before it (never its own day); put off past one of theirs already planned, it\'s simply off and that one\'s next',
    fn() {
      const { s, c, bus } = hub(72), now = s.time.ms, a = c.posting.assets[0], me = s.people.me;
      me.burners = 2;
      let m = nextMeeting(c, a.id, now);
      if (!m || day(m.from) < day(now) + 3) {                      // (one three days on, for the test)
        const from = (day(now) + 3) * DAY + 19 * 60 * MIN;
        if (m) Object.assign(m, { from, to: from + 15 * MIN, start: from - 30 * MIN });
        else c.assignments.push(m = { id: 'aT', kind: 'sdr', who: a.id, from, to: from + 15 * MIN, start: from - 30 * MIN, status: 'open', brief: 'between 19:00 and 19:15' });
      }
      // (every evening before it taken: nowhere to bring it to)
      const fill = [];
      for (let d = day(now) + 1; d < day(m.from); d++) if (!c.assignments.some(x => x.status === 'open' && day(x.from) === d)) { const x = { id: `f${d}`, kind: 'tail', who: 'nobody', from: d * DAY + 19 * 60 * MIN, to: d * DAY + 19 * 60 * MIN + 20 * MIN, start: d * DAY + 19 * 60 * MIN, status: 'open' }; c.assignments.push(x); fill.push(x); }
      const way = callWays(c, a, now).find(w => w.key === 'forward');
      const was = m.from;
      const r0 = call(s, bus, a.id, 'burner', 'forward');
      assert(!way.ok && !r0.ok && m.from === was, `no free evening before it: it can't be (${way.why})`);
      for (const x of fill) x.status = 'missed';                    // (the evenings freed)
      const r1 = call(s, bus, a.id, 'burner', 'forward');
      assert(r1.ok && day(m.from) < day(was), 'freed: brought forward, to before its own day');
      // (one of theirs already two days after it: put off three, it's off, and that one's next)
      const later = { id: 'aL', kind: 'sdr', who: a.id, from: m.from + 2 * DAY, to: m.from + 2 * DAY + 15 * MIN, start: m.from + 2 * DAY - 30 * MIN, status: 'open', brief: 'between 19:00 and 19:15' };
      c.assignments.push(later);
      me.burners = 1;
      const r2 = call(s, bus, a.id, 'burner', 'off');
      console.log(`      no free evening before it: "${way.why}"; freed: ${dateText(was)} → ${dateText(m.from)}; put off with one of theirs after: ${m.status}, next ${nextMeeting(c, a.id, now)?.id} ("${r2.text.slice(-90)}")`);
      assert(r2.ok && m.status === 'off' && nextMeeting(c, a.id, now) === later, 'off, and theirs is next');
    },
  },
  {
    name: 'phone: a meeting brought forward to tomorrow, put off three days; a word warms them, not again for days; a burner spent each call; all from the mind\'s desk command',
    fn() {
      const { s, c, bus } = hub(71), now = s.time.ms, a = c.posting.assets[0], me = s.people.me;
      me.burners = 3;
      const m0 = nextMeeting(c, a.id, now), was = m0 && `${dateText(m0.from)} ${clockText(m0.from)}`;
      step(s, { act: [`desk:phone:${a.id}:burner:forward`] }, bus);
      const m1 = nextMeeting(c, a.id, now), m1From = m1.from, fwd = `${dateText(m1.from)} ${clockText(m1.from)}`;   // (the same meeting is moved again below)
      const clash = c.assignments.filter(x => x.status === 'open' && day(x.from) === day(m1From)).length;
      step(s, { act: [`desk:phone:${a.id}:burner:off`] }, bus);
      const m2 = nextMeeting(c, a.id, now);
      const t0 = a.trust;
      step(s, { act: [`desk:phone:${a.id}:burner:word`] }, bus);
      const t1 = a.trust, again = callWays(c, a, s.time.ms).find(w => w.key === 'word');
      console.log(`      ${a.codename}: next meeting ${was ?? 'none'} → forward: ${fwd} (alone that day: ${clash === 1}) → off: ${dateText(m2.from)} ${clockText(m2.from)}; a word: trust ${t0} → ${t1}, again: "${again.why}"; burners 3 → ${me.burners ?? 0}; the log: "${s.log.at(-1).text.slice(0, 120)}…"`);
      assert(day(m1From) >= day(now) + 1 && day(m1From) <= day(now) + 2 && clash === 1, 'forward: tomorrow, or the first free evening; one a day');
      assert(day(m2.from) - day(m1From) >= 3, 'off: three days on');
      assert(t1 === Math.min(5, t0 + 1) && !again.ok && (me.burners ?? 0) === 0, 'a word warms; not again soon; a burner a call');
      const r = call(s, bus, a.id, 'burner', 'forward');
      assert(!r.ok && /No burner/.test(r.text), 'no burner, no call from one');
    },
  },
  {
    name: 'phone: your own phone traced: heat on you, and the hotter you are, the likelier the asset\'s looked at; a burner traces nothing',
    fn() {
      const rows = [];
      for (const h of [20, 50, 80]) {
        let burned = 0, n = 0, dHeat = 0;
        for (let seed = 1; seed <= 100; seed++) {
          const { s, c, bus } = hub(100 + seed), a = c.posting.assets[0];
          c.posting.heat = h; s.heat[Object.keys(s.heat)[0] ?? 'x'] = h;
          const h0 = heat(s);
          s.time.ms += seed * 7 * MIN;                                // (each call at its own minute: its own dice)
          call(s, bus, a.id, 'own', 'word');
          dHeat += heat(s) - h0; burned += !!a.burned; n++;
        }
        rows.push(`heat ${h}: ${Math.round(100 * burned / n)}% looked at, +${(dHeat / n).toFixed(1)} heat`);
      }
      const { s, c, bus } = hub(99), a = c.posting.assets[0], h0 = heat(s);
      s.people.me.burners = 1;
      call(s, bus, a.id, 'burner', 'word');
      console.log(`      from your own phone: ${rows.join('; ')}; from a burner: +${heat(s) - h0} heat, looked at ${!!a.burned}`);
      assert(rows.every(r => r.includes(`+${OWN_HEAT}.0`)) && heat(s) === h0 && !a.burned, 'own: heat; a burner: nothing');
      const pct = rows.map(r => Number(/(\d+)% looked/.exec(r)[1]));
      assert(pct[2] > pct[0], 'the hotter, the likelier');
    },
  },
];
