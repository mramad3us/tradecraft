// TRADECRAFT sim: a gun's work at a table (the user, 2026-11-03: "in the appartment, close to the table we should be
// able to do things like recondition magazines, take bullets out of magazine, unload the gun (remove the
// magazine, then clear the chamber) and all of these actions can fail with varying consequences depending on
// weapons skill"). Sat at the flat's kitchen table (sim/scenarios/campaign.js), with what you carry: ways()
// lists the jobs, work() does one, its time skipped, a Weapon handling roll against its DC (JOBS), the pace
// of the hand (sim/firearms.js pace()) setting how long. What a fumble costs is the job's, worse the worse the
// miss (BAD_BY under):
//   - **unload** a gun: the magazine out, then the chamber cleared (a revolver's cylinder, a pump's tube, all of
//     it into the box of its calibre). Badly fumbled with a round in the chamber, it goes off: where it
//     points is the hand's muzzle discipline (sim/shooting.js discharge(): a trained hand, the floor), and the
//     building hears it (BANG_HEAT, in the campaign);
//   - **load** a gun: the fullest magazine of its family in, a round chambered;
//   - **clean** a gun (SERVICE): stripped, cleaned, oiled, its condition back (sim/firearms.js service());
//     unloaded first, as anyone with sense does. Fumbled, it takes twice as long; badly, it goes back
//     together wrong (BADLY_COND: it'll jam till it's done again);
//   - **fill** a magazine from the loose rounds of its calibre, a round at a time; **empty** one into the box.
//     Fumbled, rounds go on the floor, and LOST of them under the furniture for good;
//   - **recondition** a magazine (its spring and its lips: cond back to MAG_FRESH): fumbled, the spring's
//     across the room and it takes twice as long; badly, a lip's bent (BENT_COND: it feeds badly, sim/
//     firearms.js fire()'s MAG_JAM).
import { isGun, isMag, armOf, modelOf, famCap, famCal, armName, calWord, pace, service, MAG_FRESH } from './firearms.js';
import { check } from './checks.js';
import { skill } from './skills.js';
import { int } from './rng.js';
import { say } from './log.js';
import { addHeat } from './heat.js';

export const JOBS = {
  unload: { s: 6, dc: 8 }, load: { s: 4, dc: 7 }, clean: { s: 20 * 60, dc: 9 },
  fill: { s: 2.2, dc: 6 }, empty: { s: 1, dc: 4 }, spring: { s: 10 * 60, dc: 10 },
};
export const NAT1_BAD_BELOW = 10, BAD_BY = 8, LOST = [1, 3], BADLY_COND = 0.5, BENT_COND = 0.3, BANG_HEAT = 4;

const guns = (p) => [p.hand, ...(p.items ?? [])].filter(isGun);
const mags = (p) => (p.items ?? []).filter(isMag);
const loaded = (g, M) => (M.feed === 'cylinder' ? g.cyl.some(c => c === 'live' || c === 'dud') : M.feed === 'tube' ? g.tube > 0 || !!g.chamber : !!g.mag || !!g.chamber);
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/** The jobs at the table, with what p has: [{ key, label }]. */
export function ways(p) {
  const out = [];
  for (const id of guns(p)) {
    const g = armOf(p, id), M = modelOf(id), name = M.short;
    if (!g) continue;
    if (loaded(g, M)) out.push({ key: `unload:${id}`, label: `Unload ${name}: ${M.feed === 'cylinder' ? 'the cylinder emptied' : M.feed === 'tube' ? 'the tube and the chamber emptied' : 'the magazine out, the chamber cleared'}` });
    else if (M.feed === 'mag' && mags(p).some(m => armOf(p, m)?.fam === (M.mag ?? g.model) && armOf(p, m).n > 0)) out.push({ key: `load:${id}`, label: `Load ${name}: a magazine in, a round chambered` });
    out.push({ key: `clean:${id}`, label: `Strip and clean ${name}${g.cond < 0.6 ? ' (it needs it)' : ''}: 20 min` });
  }
  for (const id of mags(p)) {
    const m = armOf(p, id), cal = famCal(m.fam), loose = p.rounds?.[cal] ?? 0, word = armName(id);
    if (m.n < famCap(m.fam) && loose > 0) out.push({ key: `fill:${id}`, label: `Fill ${word} (${m.n} of ${famCap(m.fam)}) from the box of ${calWord(cal)}` });
    if (m.n > 0) out.push({ key: `empty:${id}`, label: `Empty ${word} (${m.n}) into the box` });
    if ((m.cond ?? MAG_FRESH) < 0.9) out.push({ key: `spring:${id}`, label: `Recondition ${word}: the spring, the lips (10 min)` });
  }
  return out;
}

/**
 * A job done (`job:id`): its roll, its time (returned, in ms: the caller skips it), what it changed, its words in
 * the log. `bang` (state, bus, id): the caller's, for a round gone off (sim/shooting.js discharge()).
 */
export function work(state, bus, p, key, { bang = null } = {}) {
  const [job, ...rest] = key.split(':'), id = rest.join(':'), J = JOBS[job];
  if (!J || !armOf(p, id)) return 0;
  const roll = check(state.rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: J.dc, body: p });
  const bad = !roll.ok && (roll.margin <= -BAD_BY || (roll.nat === 1 && roll.value < NAT1_BAD_BELOW)), k = pace(p);   // (a natural 1 in an untrained hand is the bad one)
  let s = J.s * k * (roll.ok ? 1 : 2), text = '';
  if (job === 'unload') {
    const g = armOf(p, id), M = modelOf(id), back = unload(p, id);
    if (bad && back.chambered) {                                   // (the slide worked with a finger where it shouldn't be)
      p.rounds[M.cal] -= 1; if (p.rounds[M.cal] <= 0) delete p.rounds[M.cal];   // (that round's the one that went)
      say(state, bus, { kind: 'roll', roll, text: 'The slide back, the trigger finger inside the guard: it goes off on the table.' });
      bang?.(state, bus, id);
      if (state.campaign) addHeat(state, BANG_HEAT);                 // (the building heard it)
      return Math.round(s * 1000);
    }
    text = `${M.short} unloaded: ${back.rounds ? `${back.rounds} round${back.rounds > 1 ? 's' : ''} back in the box` : 'nothing in it but air'}${back.mag ? ', the magazine beside it' : ''}.${!roll.ok ? ' Clumsily: a round on the floor, found.' : ''}`;
    if (g) g.known = true;
  } else if (job === 'load') {
    const g = armOf(p, id), M = modelOf(id), fam = M.mag ?? g.model;
    const m = mags(p).filter(x => armOf(p, x).fam === fam).sort((a, b) => armOf(p, b).n - armOf(p, a).n)[0];
    if (!m) return 0;
    p.items = p.items.filter(x => x !== m); g.mag = m;
    const mag = armOf(p, m);
    if (mag.n > 0 && !g.chamber) { mag.n--; g.chamber = 'live'; g.locked = false; if (M.decocker) g.cocked = false; }   // (chambered, and the hammer let down: carried as it should be)
    if (M.safety === 'manual') g.safety = true;
    if (M.safety === 'selector') g.mode = 'safe';
    text = `${M.short} loaded: ${mag.n} in the magazine, one in the chamber${M.safety === 'manual' ? ', the safety on' : M.decocker ? ', decocked' : ''}.`;
    g.known = true;
  } else if (job === 'clean') {
    const g = armOf(p, id), M = modelOf(id), back = loaded(g, M) ? unload(p, id) : null;
    if (back) s += JOBS.unload.s * k;
    if (bad) { g.cond = Math.min(g.cond, BADLY_COND); text = `${M.short} stripped and cleaned, and back together with a spring in wrong: it'll jam till it's done again.`; }
    else { service(p, id); text = `${M.short} stripped, cleaned and oiled${back ? `, unloaded first (${back.rounds} in the box)` : ''}.${!roll.ok ? ' It took a while: a pin under the fridge.' : ''}`; }
    g.known = true;
  } else if (job === 'fill' || job === 'empty') {
    const m = armOf(p, id), cal = famCal(m.fam), before = m.n;
    const n = job === 'fill' ? Math.min(famCap(m.fam) - m.n, p.rounds?.[cal] ?? 0) : m.n;
    if (n <= 0) return 0;
    s = J.s * n * k * (roll.ok ? 1 : 1.5);
    const lost = roll.ok || (roll.nat === 1 && roll.value >= NAT1_BAD_BELOW) ? 0 : Math.min(n, int(state.rng, LOST[1] - LOST[0] + 1) + LOST[0]);   // (a skilled hand's slip is caught)
    p.rounds ??= {};
    if (job === 'fill') { p.rounds[cal] -= n; m.n += n - lost; }
    else { m.n = 0; p.rounds[cal] = (p.rounds[cal] ?? 0) + n - lost; }
    if (p.rounds[cal] <= 0) delete p.rounds[cal];
    text = `${cap(armName(id))}: ${job === 'fill' ? `${before} → ${m.n}` : `${n - lost} round${n - lost === 1 ? '' : 's'} into the box`}.${lost ? ` ${lost} went skittering under the furniture, and stay there.` : ''}`;
  } else if (job === 'spring') {
    const m = armOf(p, id);
    if (bad) { m.cond = BENT_COND; text = `The spring's out with a twang, and a lip of ${armName(id)} bent getting it back: it'll feed badly now.`; }
    else { m.cond = MAG_FRESH; text = `${cap(armName(id))}: a new spring's tension, the lips set true.${!roll.ok ? ' The spring went across the room first.' : ''}`; }
  }
  say(state, bus, { kind: 'roll', roll, text });
  return Math.round(s * 1000);
}

/** Everything out of a gun into its holder's hands: the magazine to the pockets, the rounds to the box. */
function unload(p, id) {
  const g = armOf(p, id), M = modelOf(id), out = { rounds: 0, mag: false, chambered: false };
  p.rounds ??= {};
  const back = (n) => { if (n > 0) { p.rounds[M.cal] = (p.rounds[M.cal] ?? 0) + n; out.rounds += n; } };
  if (M.feed === 'cylinder') { back(g.cyl.filter(c => c === 'live').length); g.cyl = g.cyl.map(() => null); g.open = false; return out; }
  if (M.feed === 'tube') { back(g.tube); g.tube = 0; }
  if (g.mag) { (p.items ??= []).push(g.mag); g.mag = null; out.mag = true; }
  if (g.chamber === 'live') { out.chambered = true; back(1); }
  g.chamber = null; g.jam = null; g.locked = false;
  return out;
}
