// TRADECRAFT sim: a look at a body (the user, 2026-11-03: "woman shot twice in torso: reading them should give
// us MUCH more information about what we can see, like them bleeding, entry wounds etc"; "medicine skill should
// lead to us rolling for diagnosis"). What anyone can see of someone hurt, and what a Medicine roll finds
// besides. Your read of someone (F, Read) and first aid (F, First aid; H on yourself) both show it
// (src/ui/body.js: the figure, the wounds marked where they are, and the words); the body itself is
// sim/health.js, its care sim/medicine.js and sim/aid.js.
//
// **Plain sight** (no roll): whether they're up or down, moving, conscious; where the wounds are (a hole in the
// coat, a cut, a split lip, a bloody nose) and whether they bleed (badly: anyone can see that); a dressing, a
// tourniquet, a splint; pale, grey; a limb that hangs wrong; a face swollen. On yourself, what hurts where too:
// you feel it. Not what lies under it: what made a hole, whether the bullet came out, a crack, bleeding inside.
//
// **The look** (diagnose()): a Medicine check against DIAGNOSE_DC, on the medic's own body like any roll (sim/
// checks.js), harder in the dark or the dusk, on someone who won't keep still, on yourself (LOOK_MODS). What it
// finds goes by the margin it's made by (FINDS, each finding's margin):
//   - breath, −4: whether someone down is breathing (an airway's the first thing taught), dead or not;
//   - kind, 0: what each wound is (a bullet's hole, a graze, a stab); the blunt hurts under the clothes; rate,
//     0: how fast each bleeds (a trickle, steadily, heavily, fast);
//   - artery, 2: an artery cut (bright, spurting); fracture, 2: a break, named; shock, 2: the blood's state;
//   - through, 4: a bullet's entry, and its exit or none (the bullet still in); crack, 4: a cracked rib, a
//     cracked shin; needs, 4: what it'll take (first aid, stitches, a splint, or a hospital and how fast);
//   - inside, 8: bleeding inside (sim/shooting.js: a chest wound's, a bullet in the skull's), found, or ruled
//     out; blood, 8: how much is left, and at this rate how long till they're down, and dead.
// So an untrained eye (Medicine 0) makes the look about half the time and finds bleeding inside one time in
// seven; a course (5) four times in five, and two in five; Medicine 10 nearly always, and two in three; 20,
// all of it but on a natural 1, which fails anyone (its margin, whatever the sum, counts as under 0). A
// failed look tells nothing more than plain sight, and says so the safe way: you can't tell what's inside,
// so treat it as bad; if in doubt, a hospital. It never says there's nothing.
//
// The look is kept on the patient a while (patient.$dx: runtime, not saved; LOOK_KEEP_MIN), and covers the
// wounds there were when it was taken: one made after it shows as plain sight. A look again rolls again,
// but not sooner than LOOK_AGAIN_S unless something's happened to the body since (its sig); on the same
// wounds the better of the two looks stands (what you've seen, you've seen), and after something new, what
// the earlier look saw of the wounds then it still knows ($dx.prior).
//
// findings() is what the screens show: plain data, read live from the body as it stands (up or down this
// moment, the blood falling, the dressing on now), through the look's margin: the posture, a line each for
// what's general (conscious, the blood and the minutes it gives, minutesTo(), inside), a numbered row for each
// wound head to foot (its words, its care, how bad: the plaque on the figure), what it'll take, and the marks
// for the figure (src/art/doll.js wounds). seenName() is a wound's name as far as it's known (sim/aid.js names
// the options by it).
import { check } from './checks.js';
import { skill } from './skills.js';
import { say } from './log.js';
import { stateOf, bandOf, bloodOf, bleedRate, canStand, BLOOD, PARTS } from './health.js';
import { careWords, broken, bandageOf } from './medicine.js';
import { lightHere } from './perception.js';
import { lightBand } from './light.js';
import { hash } from './rng.js';

export const DIAGNOSE_DC = 10;
export const FINDS = { breath: -4, kind: 0, rate: 0, artery: 2, fracture: 2, shock: 2, through: 4, crack: 4, needs: 4, inside: 8, blood: 8 };
export const LOOK_MODS = { dark: -3, dim: -1, walking: -2, running: -5, self: -2 };
export const LOOK_AGAIN_S = 60, LOOK_KEEP_MIN = 30;
export const RATE_WORDS = [[8, 'bleeding fast: minutes, not hours'], [3, 'bleeding heavily'], [0.5, 'bleeding steadily'], [0, 'a trickle']];
const WHERE = { head: 'head', torso: 'chest', armL: 'left arm', armR: 'right arm', legL: 'left leg', legR: 'right leg' };
const LIMBS = ['armL', 'armR', 'legL', 'legR'];
const ORDER = ['head', 'torso', 'armR', 'armL', 'legR', 'legL'];

/** Whether there's anything wrong with a body at all: what a look is for. */
export const hurtAtAll = (p) => !!p && (!!p.dead || !!p.injuries?.length || Object.keys(p.body ?? {}).length > 0 || bloodOf(p) < 100 || !!p.tourniquets || !!p.splints);
/** What's happened to a body, as one string: when it changes, a look again rolls again whenever. */
const sigOf = (p) => [p.injuries?.length ?? 0, ...Object.keys(PARTS).map(k => Math.round(p.body?.[k] ?? 0)), p.dead ? 'd' : ''].join(',');

/** The look on a patient at game time ms, if it's still kept, or null. */
export const lookOf = (p, ms) => (p?.$dx && ms - p.$dx.ms < LOOK_KEEP_MIN * 60000 ? p.$dx : null);
/** Whether the look on p (at ms) finds `what` (a FINDS key), for injury i if given (one made after the look, it didn't see; one an earlier look saw, the better of the two). */
export function finds(p, ms, what, i = null) {
  const L = lookOf(p, ms);
  if (!L) return false;
  if (!i) return L.margin >= FINDS[what];
  if ((i.ms ?? 0) > L.ms) return false;
  return Math.max(L.margin, L.prior && (i.ms ?? 0) <= L.prior.ms ? L.prior.margin : -99) >= FINDS[what];
}

/** How someone is placed, from their actor: 'dead', 'down', 'running', 'walking', 'standing'. */
export function postureOf(p, a) {
  if (p.dead) return 'dead';
  if ((a && a.gait === 'down') || !canStand(p)) return 'down';
  const v = a ? Math.hypot(a.vx ?? 0, a.vz ?? 0) : 0;
  return v > 2.5 && a.gait === 'run' ? 'running' : v > 0.3 ? 'walking' : 'standing';
}

/**
 * A look at patientActor by medicActor (the same, for yourself): the Medicine check, logged, kept on the
 * patient (patient.$dx: { ms, sig, margin, ok, roll }). Not rolled again within LOOK_AGAIN_S on a body
 * that's the same; nothing to roll for on someone unhurt. Returns the look, or null.
 */
export function diagnose(state, bus, medicActor, patientActor) {
  const medic = state.people[medicActor?.who], p = state.people[patientActor?.who], ms = state.time.ms;
  if (!medic || !p || !hurtAtAll(p)) return null;
  const was = lookOf(p, ms), sig = sigOf(p);
  if (was && was.sig === sig && ms - was.ms < LOOK_AGAIN_S * 1000) return was;      // (looked just now: the same look)
  const self = medicActor === patientActor, pose = postureOf(p, patientActor), light = lightBand(lightHere(state, patientActor.x, patientActor.z));
  const mods = [self && { why: 'on yourself', v: LOOK_MODS.self }, light === 'dark' && { why: 'in the dark', v: LOOK_MODS.dark }, light === 'dim' && { why: 'in the dusk', v: LOOK_MODS.dim },
    !self && pose === 'running' && { why: 'they won\'t keep still', v: LOOK_MODS.running }, !self && pose === 'walking' && { why: 'on the move', v: LOOK_MODS.walking }].filter(Boolean);
  const roll = check(state.rng, { skill: 'medicine', value: skill(medic, 'medicine'), dc: DIAGNOSE_DC, mods, body: medic });
  const margin = roll.ok ? roll.margin : Math.min(-1, roll.margin);                 // (a natural 1 fails, whatever the sum: it finds nothing)
  // (the same wounds: what you've seen, you've seen, the better look kept; something new since: what the last look saw of the wounds then, it still knows)
  const keep = was && was.sig === sig && was.margin > margin;
  const prior = was && was.sig !== sig ? { ms: was.ms, margin: Math.max(was.margin, was.prior?.margin ?? -99) } : was?.prior;
  p.$dx = keep ? { ...was, ms } : { ms, sig, margin, ok: roll.ok, roll, ...(prior ? { prior } : {}) };
  const them = self ? 'yourself' : p.sex === 'f' ? 'her' : 'him', look = self ? 'check' : 'look';
  const text = !roll.ok ? `You ${look} ${them} over, and can't make sense of it: blood, and what's under it you can't say.`
    : roll.margin >= FINDS.inside ? `You ${look} ${them} over, quick and sure: the wounds, the blood, the breathing, what's under it.`
      : roll.margin >= FINDS.through ? `You ${look} ${them} over: the wounds, how they bleed, what they'll need.`
        : `You ${look} ${them} over: the wounds, and how they bleed.`;
  say(state, bus, { kind: 'roll', roll, text: keep ? `${text} Nothing you hadn't seen.` : text });
  return p.$dx;
}

// ---------- what a wound is called, as far as it's known ----------

const gunshotOf = (i) => !!i.gunshot && i.kind === 'cut';
const isGraze = (i) => gunshotOf(i) && /graze/.test(i.name ?? '');
/** Whether a bullet went through (sim/shooting.js bullet(): i.through; a wound from before it kept that, by its own dice). */
export const throughOf = (i) => (i.through !== undefined ? !!i.through : !i.internal && !isGraze(i) && hash('through', i.ms ?? 0, i.part) % 100 < 45);
const limbWord = (part) => (part.startsWith('arm') ? 'arm' : 'leg');
const sideWord = (part) => (part.endsWith('L') ? 'left' : 'right');

/** Whether a wound shows at all to someone looking (bleeding inside, a crack, a fracture under the skin: not without the look). */
function shows(p, i, ms, self) {
  if (i.internal) return i.part === 'head' || finds(p, ms, 'inside', i);       // (a bullet in the skull went in through a hole you can see)
  if (i.kind === 'crack') return finds(p, ms, 'crack', i);
  if (i.kind === 'fracture') return finds(p, ms, 'fracture', i) || (LIMBS.includes(i.part) && (stateOf(p, i.part) === 'out' || self));
  return true;
}
/** A wound's name as it's known on p at game time ms: plain sight's, or the look's (i.name). */
export function seenName(p, i, ms, self = false) {
  if (gunshotOf(i)) {
    if (i.internal && i.part === 'torso') return i.name;
    if (finds(p, ms, 'kind', i)) return i.artery && !finds(p, ms, 'artery', i) ? `a gunshot wound in the ${WHERE[i.part]}` : i.name;
    return isGraze(i) ? 'a bloody gash in the hair' : i.part === 'head' ? 'a wound in the head' : `a wound in the ${WHERE[i.part]}`;
  }
  if (i.kind === 'cut' && i.artery && !finds(p, ms, 'artery', i)) return i.part === 'head' ? 'a deep cut on the neck' : `a deep cut on the ${sideWord(i.part)} ${limbWord(i.part)}`;
  if (i.kind === 'fracture' && !finds(p, ms, 'fracture', i)) return `the ${WHERE[i.part]}: it hangs wrong`;
  return i.name;
}

// ---------- what the screens show ----------

const rateWord = (r) => RATE_WORDS.find(([at]) => r >= at)[1];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const PART_WORDS = { bruised: 'bruised', hurt: 'hurt', wounded: 'badly hurt' };
const OUT_WORDS = { head: 'out cold', torso: 'beaten past standing' };
/** How bad a wound's bleeding is, for the figure: 0 none, 1 a trickle, 2 steadily or heavily, 3 fast. */
const bleedLevel = (i, ms) => (!(i.bleed > ms) ? 0 : (i.rate ?? 0.2) >= 8 ? 3 : (i.rate ?? 0.2) >= 0.5 ? 2 : 1);

/**
 * What a look at patient p shows, at game time now: { posture, self, look, status: [{ text, tone }], rows:
 * [{ n, idx, part, words, detail, care, tone }], needs: [{ text, tone }], marks } (marks: for the figure,
 * src/art/doll.js: { wounds: [{ part, kind, bleed, dressed, n, tone }], tourniquets, splints, bloody, inside }).
 * actor: theirs (how they're placed); self: you, looking at yourself.
 */
export function findings(state, p, { actor = null, self = false } = {}) {
  const ms = state.time.ms, L = lookOf(p, ms), made = !!L?.ok, find = (what, i = null) => finds(p, ms, what, i);
  const she = self ? 'you' : p.sex === 'f' ? 'she' : 'he', their = self ? 'your' : p.sex === 'f' ? 'her' : 'his';
  const posture = postureOf(p, actor), band = bandOf(p), blood = Math.round(bloodOf(p)), rate = bleedRate(p, ms);
  // (what shows; a chest's bleeding inside, from however many wounds, one row)
  const injuries = (p.injuries ?? []).map((i, idx) => [i, idx]).filter(([i, idx]) => shows(p, i, ms, self) && !(i.internal && i.part === 'torso' && p.injuries.findIndex(j => j.internal && j.part === 'torso') !== idx));
  const insides = (p.injuries ?? []).filter(i => i.internal && i.part === 'torso').length;
  const status = [], rows = [], needs = [];
  const awake = !p.dead && stateOf(p, 'head') !== 'out' && !['collapsed', 'dead'].includes(band);
  const chest = (p.injuries ?? []).some(i => i.part === 'torso' && i.gunshot && !i.internal);
  // (up or down, awake or not, breathing: the line everyone sees first)
  if (p.dead) status.push(find('breath') ? { text: `Dead. No pulse, no breath.`, tone: 'bad' } : { text: `Not moving. Not breathing, that you can see.`, tone: 'bad' });
  else if (!awake) status.push({ text: find('breath') ? `Out cold, but breathing${chest ? ': fast and shallow' : ''}.` : 'Down, and not moving.', tone: 'bad' });
  else if (posture === 'down') status.push({ text: self ? 'You\'re down, and can\'t get up.' : `Down, conscious: ${!canStand(p) ? `${she} can't get up` : 'in pain'}.`, tone: 'bad' });
  else status.push({ text: self ? `On your feet${posture === 'running' ? ', running' : posture === 'walking' ? ', walking' : ''}.` : `On ${their} feet${posture === 'running' ? ', running' : posture === 'walking' ? ', walking' : ''}.`, tone: 'calm' });
  // (the blood: what shows, then what the look makes of it)
  if (!p.dead) {
    if (find('blood') || self) {
      const down = minutesTo(p, ms, BLOOD.collapse), dead = minutesTo(p, ms, BLOOD.dead);
      const when = band === 'collapsed' ? (dead !== null ? ` At this rate, dead in ${mins(dead)}.` : '') : down !== null ? ` At this rate, down in ${mins(down)}${dead !== null ? `, dead in ${mins(dead)}` : ''}.` : rate > 0 ? ' It\'ll stop before it matters.' : '';
      status.push({ text: `${blood >= 97 ? 'Hardly any blood lost' : `${blood}% of ${their} blood left`}${band === 'steady' ? '' : `: ${band === 'pale' ? 'pale with it' : band === 'shock' ? 'in shock' : 'collapsed'}`}.${when}`, tone: band === 'steady' ? (down === null ? 'calm' : down < 30 ? 'bad' : 'mid') : band === 'pale' && (down === null || down >= 30) ? 'mid' : 'bad' });
    } else if (find('shock') && band !== 'steady') status.push({ text: band === 'pale' ? 'Pale: some blood lost.' : band === 'shock' ? 'In shock: cold, clammy, a fast thin pulse. A lot of blood lost.' : 'Collapsed: too much blood lost.', tone: band === 'pale' ? 'mid' : 'bad' });
    else if (band !== 'steady') status.push({ text: band === 'pale' ? 'Pale.' : band === 'shock' ? 'Grey, and sweating.' : 'Grey, clammy, gone slack.', tone: band === 'pale' ? 'mid' : 'bad' });
  }
  // (the wounds, each a row; what's bled onto them)
  for (const [i, idx] of injuries) {
    const lv = bleedLevel(i, ms), gun = gunshotOf(i), inside = i.internal && i.part === 'torso';
    const detail = [];
    if (inside) detail.push('the belly hard, the breath short: nothing hands can do for it');
    else if (i.internal) detail.push(find('inside', i) ? 'it went in, and it\'s bleeding inside the skull: a hospital, within the hour' : find('through', i) ? 'no exit: it\'s still in there' : 'blood, and hair matted in it');
    if (!i.internal && lv) detail.push(find('rate', i) ? rateWord(i.rate ?? 0.2) : (i.rate ?? 0.2) >= 3 ? 'bleeding badly' : 'bleeding');
    else if (!i.internal && i.kind !== 'crack' && i.kind !== 'fracture' && (i.bleed ?? 0) > 0 && !lv && !i.stitched && !i.dressed) detail.push('not bleeding now');
    if (i.artery && find('artery', i) && lv) detail.push('an artery: bright, spurting');
    if (gun && !i.internal && !isGraze(i) && find('through', i)) detail.push(throughOf(i) ? 'the entry, and an exit behind it: through and through' : 'the entry; no exit: the bullet\'s still in');
    if (isGraze(i) && find('kind', i)) detail.push('it didn\'t go in');
    const care = [careWords(p, i, ms), LIMBS.includes(i.part) && p.tourniquets?.[i.part] ? 'a tourniquet above it' : ''].filter(Boolean).join(', ');
    const tone = inside || i.internal || lv >= 2 || (i.artery && !i.stitched && !p.tourniquets?.[i.part]) || (i.kind === 'fracture' && LIMBS.includes(i.part) && !p.splints?.[i.part]) ? 'bad'
      : lv || i.infection || (i.kind === 'cut' && (i.deep || i.artery) && !i.stitched && !bandageOf(i, ms)) || ((i.kind === 'crack' || i.kind === 'fracture') && !p.splints?.[i.part]) ? 'mid' : 'ok';
    rows.push({ idx, part: i.part, words: inside && insides > 1 ? 'Bleeding inside, from the chest wounds' : cap(seenName(p, i, ms, self)), detail: detail.join('; '), care, tone, mark: markOf(p, i, ms, i.internal ? Math.min(1, lv) : lv), last: inside });
  }
  // (a part hurt with nothing on it to show for it: a beating, under the clothes; the face shows it, and you feel your own)
  for (const part of ORDER) {
    const st = stateOf(p, part);
    if (st === 'unhurt' || rows.some(r => r.part === part && r.mark?.kind !== 'inside')) continue;
    const plain = self || (part === 'head' && ['hurt', 'wounded', 'out'].includes(st)) || (LIMBS.includes(part) && st === 'out');
    if (!plain && !find('kind')) continue;
    const words = st === 'out' ? (LIMBS.includes(part) ? (find('fracture') || self ? `The ${WHERE[part]}: broken` : `The ${WHERE[part]}: it hangs wrong`) : `The ${part === 'head' ? 'head' : 'ribs'}: ${OUT_WORDS[part]}`)
      : part === 'head' && !find('kind') && !self ? 'The face: swollen, bruised' : `The ${part === 'torso' ? 'ribs' : WHERE[part]}: ${PART_WORDS[st]}`;
    const care = LIMBS.includes(part) ? [p.splints?.[part] && 'splinted', p.set?.[part] && 'set', p.poultices?.[part] && 'a poultice on'].filter(Boolean).join(', ') : p.poultices?.[part] ? 'a poultice on' : '';
    rows.push({ idx: null, part, words, detail: '', care, tone: st === 'out' && !(LIMBS.includes(part) && p.splints?.[part]) ? 'bad' : st === 'wounded' || st === 'out' ? 'mid' : 'ok', mark: { part, kind: st === 'out' && LIMBS.includes(part) ? 'break' : 'bruise', bleed: 0 } });
  }
  // (head to foot, as the figure's plaques run down it; on a part in the order they came, so twins keep theirs: "the first …", sim/aid.js woundName(); what bleeds inside last; how bad, the tag's colour)
  rows.sort((a, b) => ORDER.indexOf(a.part) - ORDER.indexOf(b.part) || (a.last ? 1 : 0) - (b.last ? 1 : 0) || (a.idx ?? 99) - (b.idx ?? 99)).forEach((r, k) => { r.n = k + 1; if (r.mark) Object.assign(r.mark, { n: r.n, tone: r.tone }); });
  // (inside: where a bullet or a blade went into the body, or the ribs are beaten in)
  // (never "nothing inside" while there's bleeding inside the look didn't find: one from a wound since, say)
  const deepTorso = (p.injuries ?? []).some(i => i.part === 'torso' && (i.gunshot || i.deep)) || ['wounded', 'out'].includes(stateOf(p, 'torso'));
  const ins = (p.injuries ?? []).filter(i => i.internal && i.bleed > ms), unseen = ins.filter(i => !find('inside', i)), bleedsInside = ins.length > 0;
  if (!p.dead && deepTorso && L && !(ins.length && !unseen.length)) {
    if (!ins.length && find('inside')) status.push({ text: 'No sign of bleeding inside.', tone: 'calm' });
    else status.push(made ? { text: 'Inside: you can\'t tell.', tone: 'mid' } : { text: 'What\'s inside, you can\'t tell: treat it as bad.', tone: 'bad' });
  }
  // (what it'll take)
  const looksBad = posture === 'down' || !awake || rate >= 3 || band !== 'steady' || (p.injuries ?? []).some(i => i.gunshot);
  if (!p.dead && L && !made && hurtAtAll(p)) needs.push(looksBad ? { text: 'Hard to say what it needs. If in doubt, a hospital.', tone: 'bad' } : { text: 'Hard to say what it needs.', tone: 'mid' });
  else if (!p.dead && find('needs')) needs.push(...needsOf(p, ms, find, self ? 'you' : p.sex === 'f' ? 'her' : 'him'));
  return { posture, self, dead: !!p.dead, look: L ? { margin: L.margin, ok: L.ok, roll: L.roll, ms: L.ms } : null, status, rows, needs, marks: marksOf(p, rows, ms, bleedsInside && ins.some(i => find('inside', i))) };
}

/** Minutes till the blood's down to `to` (% of the body's) at game time ms, each wound bleeding at its rate till it stops (i.bleed), or null (not within MINUTES_AHEAD). */
export const MINUTES_AHEAD = 12 * 60;
export function minutesTo(p, ms, to) {
  const bleeds = (p.injuries ?? []).filter(i => i.bleed > ms).map(i => [i.rate ?? 0.2, (i.bleed - ms) / 60000]);
  let b = bloodOf(p);
  for (let t = 1; t <= MINUTES_AHEAD; t++) {
    b -= bleeds.reduce((a, [r, left]) => a + (left >= t ? r : left > t - 1 ? r * (left - t + 1) : 0), 0);
    if (b < to) return t;
    if (!bleeds.some(([, left]) => left > t)) return null;
  }
  return null;
}
const mins = (m) => (m < 1 ? 'under a minute' : m < 90 ? `${m} minute${m === 1 ? '' : 's'}` : `about ${Math.round(m / 60)} hours`);

/** What it'll take, as far as the look sees (find: what it finds): [{ text, tone }], what has to be done now first. */
function needsOf(p, ms, find, them) {
  const out = [], inj = p.injuries ?? [];
  const insideAll = inj.filter(i => i.internal && i.bleed > ms && find('inside', i)), inside = insideAll[0];
  const outside = inj.filter(i => !i.internal && i.bleed > ms), heavy = outside.filter(i => (i.rate ?? 0) >= 3), artery = inj.find(i => i.artery && !i.stitched && find('artery', i));
  if (heavy.length) out.push({ text: `Stop the bleeding, now: hands pressed on it, a dressing${heavy.some(i => LIMBS.includes(i.part) && (i.deep || i.artery)) ? ', a tourniquet above it' : ''}.`, tone: 'bad' });
  else if (outside.some(i => i.deep || i.artery || (i.rate ?? 0) >= 0.5)) out.push({ text: 'A dressing on what bleeds.', tone: 'mid' });
  if (inside) {
    // (how long the bleeding inside gives them on its own, the rest stopped: the time there is to get them there)
    const own = insideAll.reduce((a, i) => a + (i.rate ?? 0), 0), m = Math.max(0, Math.round((bloodOf(p) - BLOOD.collapse) / Math.max(0.01, own)));
    out.push({ text: `A hospital, and fast: nothing first aid does stops bleeding inside${inside.part === 'head' ? ' the skull' : ''}. ${outside.length ? 'With the rest stopped, it alone' : 'It'} has ${them} down in ${mins(m)}.`, tone: 'bad' });
  } else if (inj.some(i => i.gunshot && !i.internal && i.part === 'torso' && !find('inside', i))) out.push({ text: 'A hospital: a bullet in the body is a surgeon\'s, and what it did inside you can\'t see.', tone: 'bad' });
  if (artery && !inside) out.push({ text: artery.part === 'head' || artery.part === 'torso' ? 'An artery: a hospital ties it off.' : `An artery: a tourniquet holds it${p.tourniquets?.[artery.part] ? ' (it\'s on)' : ''}; it needs tying off, stitches or a hospital, inside two hours.`, tone: 'bad' });
  const bullet = inj.find(i => gunshotOf(i) && !i.internal && !isGraze(i) && !throughOf(i));
  if (bullet) out.push({ text: 'A bullet still in: a surgeon\'s, in time.', tone: 'mid' });
  const gash = inj.find(i => i.kind === 'cut' && (i.deep || i.artery) && !i.gunshot && !i.stitched);
  if (gash) out.push({ text: `Stitches${bandageOf(gash, ms) ? '' : ', or a bandage at least'}: it won't close on its own.`, tone: 'mid' });
  const brk = LIMBS.find(k => broken(p, k, stateOf) && (!p.splints?.[k] || !p.set?.[k]));
  if (brk) out.push({ text: `The ${WHERE[brk]}: ${[!p.set?.[brk] && 'set it', !p.splints?.[brk] && 'splint it'].filter(Boolean).join(', ')}.`, tone: 'mid' });
  if (!out.length) out.push({ text: hurtAtAll(p) ? 'Nothing that won\'t mend with rest and a little care.' : 'Nothing wrong.', tone: 'calm' });
  return out;
}

/** A wound's mark on the figure: { part, kind, bleed, dressed, stitched, spurt }. */
function markOf(p, i, ms, lv) {
  const kind = i.internal && i.part === 'torso' ? 'inside' : gunshotOf(i) ? (isGraze(i) ? 'graze' : 'hole') : i.kind === 'cut' ? (i.deep || i.artery ? 'gash' : 'cut')
    : i.kind === 'fracture' ? (LIMBS.includes(i.part) ? 'break' : 'bruise') : i.kind === 'crack' ? 'crack' : i.kind === 'split' && /lip/.test(i.name ?? '') ? 'lip' : i.kind;   // (split: a brow; nose)
  return { part: i.part, kind, bleed: kind === 'inside' ? 0 : lv, dressed: bandageOf(i, ms) ? (i.rag ? 'rag' : 'bandage') : i.dressed ? 'bandage' : null, stitched: !!i.stitched, spurt: !!i.artery && lv >= 2 && !p.tourniquets?.[i.part] };
}
/** All the figure's marks: the rows', the tourniquets and splints, the blood worn, what bleeds inside. */
function marksOf(p, rows, ms, inside) {
  return { wounds: rows.map(r => r.mark).filter(m => m && (m.kind !== 'inside' || inside)), tourniquets: Object.keys(p.tourniquets ?? {}), splints: Object.keys(p.splints ?? {}),
    bloody: { face: p.bloody?.face !== undefined, clothes: p.bloody?.clothes !== undefined }, inside };
}
