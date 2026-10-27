// TRADECRAFT sim: a fight in words (sim/cqc.js; the user, 2026-10-26: "the flavour text needs to also
// have many variations", "damage taken should also have more flavour about the pain").
//
// exchangeText() tells an exchange from our side: what each did (by technique: a beginner's swing is
// not an expert's elbow), what came of it, and what it did to the body: theirs as it looks from here,
// ours as it feels, by the part and how hard (SEVERITY: the blow as a share of what the part can
// take). Lines are picked by a hash of the fight's round, never by the dice, so words never move a
// roll. {n} is their name, {he}/{him}/{his} their pronouns (the character's), {w} the weapon in the
// hand of whoever's doing it (sim/weapons.js: 'the penknife').
import { weaponOf, bare } from './weapons.js';
import { hash } from './rng.js';

export const SEVERITY = [[0.15, 'light'], [0.3, 'solid'], [0.5, 'heavy'], [Infinity, 'brutal']];
const sev = (force) => SEVERITY.find(([t]) => force < t)[1];

// What each does, by technique: [ours, theirs].
const DOES = {
  swing: [['you swing, wide and slow', 'you haul back and throw a wild right', 'you swing from somewhere around your knees'],
    ['{n} swings, wide and slow', '{n} hauls back and throws a wild right', '{n} winds up a swing you could set a watch by']],
  jab: [['you snap out a jab', 'you flick a jab at {his} face', 'you lead with a jab'], ['{n} snaps out a jab', '{n} flicks a jab at your face', '{n} leads with a jab']],
  cross: [['you throw a straight right', 'you fire a cross down the middle', 'you put your shoulder behind a straight right'], ['{n} throws a straight right', '{n} fires a cross down the middle', '{n} puts a shoulder behind a straight right']],
  hook: [['you loop a hook round {his} guard', 'you dig in a short hook', 'you turn a hook in from the side'], ['{n} loops a hook round your guard', '{n} digs in a short hook', '{n} turns a hook in from the side']],
  kick: [['you drive a front kick into {his} middle', 'you push-kick', 'you snap a kick off the front foot'], ['{n} drives a front kick at your middle', '{n} push-kicks', '{n} snaps a kick off the front foot']],
  elbow: [['you step in and swing an elbow', 'you bring an elbow across, short and hard', 'you close in behind an elbow'], ['{n} steps in behind an elbow', '{n} brings an elbow across, short and hard', '{n} closes in and swings an elbow']],
  knee: [['you clinch and drive a knee up', 'you pull {him} onto a knee', 'you bring a knee up through the middle'], ['{n} clinches and drives a knee up', '{n} pulls you onto a knee', '{n} brings a knee up through the middle']],
  lowkick: [['you chop a low kick into {his} thigh', 'you kick at the leg, low and mean', 'you sweep a shin into {his} thigh'], ['{n} chops a low kick at your thigh', '{n} kicks at your leg, low and mean', '{n} whips a shin into your thigh']],
  palm: [['you drive the heel of your palm at {his} jaw', 'you strike open-handed, up under the chin', 'you shove a palm into {his} face'], ['{n} drives the heel of a palm at your jaw', '{n} strikes open-handed, up under your chin', '{n} shoves a palm at your face']],
  roundhouse: [['you whip a kick round at {his} head', 'you turn your hip over and kick high', 'you throw a roundhouse, head height'], ['{n} whips a kick round at your head', '{n} turns a hip over and kicks high', '{n} throws a roundhouse, head height']],
  shove: [['you grab cloth and shove', 'you get two hands on {him} and push', 'you bundle into {him}'], ['{n} grabs cloth and shoves', '{n} gets two hands on you and pushes', '{n} bundles into you']],
  hip: [['you step in for a hip throw', 'you get a grip and turn in', 'you load {him} onto your hip'], ['{n} steps in for a hip throw', '{n} gets a grip and turns in', '{n} loads you onto a hip']],
  sweep: [['you reach for {his} sleeve and sweep the leg', 'you hook a foot behind {his} heel', 'you go for the sweep'], ['{n} reaches for your sleeve and sweeps', '{n} hooks a foot behind your heel', '{n} goes for the sweep']],
  armlock: [['you trap an arm and turn it', 'you go for the arm', 'you catch {his} wrist and wind it up'], ['{n} traps your arm and turns it', '{n} goes for the arm', '{n} catches your wrist and winds it up']],
  choke: [['you slip behind and go for the neck', 'you get a forearm across {his} throat', 'you go for the choke'], ['{n} slips behind you for the neck', '{n} gets a forearm across your throat', '{n} goes for the choke']],
  block: [['you cover', 'you bring both hands up', 'you tuck in behind your hands'], ['{n} covers', '{n} brings both hands up', '{n} tucks in behind both hands']],
  parry: [['you wait for it, hands loose', 'you set to parry', 'you keep your hands soft, ready'], ['{n} waits, hands loose', '{n} sets to parry', '{n} keeps the hands soft']],
  slip: [['you stay loose, chin down', 'you weave, ready to slip it', 'you sit back on your heels'], ['{n} stays loose, chin down', '{n} weaves', '{n} sits back on the heels, light']],
  open: [['you can\'t make your hands do anything', 'you stand there, dazed', 'your arms don\'t answer'], ['{n} stands there, wide open', '{n}\'s hands hang', '{n} never gets them up']],
};

// Armed (sim/weapons.js TECHS): [ours, theirs]; {w} the weapon.
const ARMED = {
  slash: [['you slash at {him} with {w}', 'you whip {w} across, backhand', 'you cut at {his} face with {w}'], ['{n} slashes at you with {w}', '{n} whips {w} across at you', '{n} cuts at your face with {w}']],
  stab: [['you drive {w} in, low', 'you stab at {his} middle with {w}', 'you lunge with {w}'], ['{n} drives {w} at you, low', '{n} stabs at your middle with {w}', '{n} lunges with {w}']],
  club: [['you bring {w} down, overhand', 'you swing {w} at {his} head', 'you lay into {him} with {w}'], ['{n} brings {w} down, overhand', '{n} swings {w} at your head', '{n} lays into you with {w}']],
  thrust: [['you jab the end of {w} into {his} middle', 'you drive {w} forward like a spear', 'you ram {w} at {his} face'], ['{n} jabs the end of {w} into your middle', '{n} drives {w} at you like a spear', '{n} rams {w} at your face']],
  wblock: [['you hold {w} across', 'you bring {w} up across your body', 'you set {w} between you'], ['{n} holds {w} across', '{n} brings {w} up across the body', '{n} sets {w} between you']],
};
const THROUGH = [[' The edge comes through your guard: {injury}.', ' You stop most of it; the rest opens you up: {injury}.', ' Not clean: {injury}.'],
  [' The edge goes through {his} guard: {injury}.', ' {n} stops most of it, not all: {injury}.', ' Not clean, for {him}: {injury}.']];
const BRUISED = [[' It comes through your guard anyway, into the arm.', ' Your forearm takes the rest of it.'], [' It comes through {his} guard anyway.', ' {his} forearm takes the rest of it.']];
const CLEAN = [[' A clean block: the blade never touches you.', ' Clean: nothing gets through.'], [' {n} blocks it clean.', ' Clean: nothing gets through to {him}.']];
const FUMBLED = [['you grab at {him} with {w} in your fist, and the grip won\'t take', 'you reach for cloth, {w} in the way, and get nothing'], ['{n} grabs at you, {w} in the way, and gets nothing', '{n}\'s grip won\'t take, {w} in the hand']];
const DROPPED = [[' Your {wd} goes flying.', ' Your {wd} clatters away across the ground.'], [' {his} {wd} goes flying.', ' {his} {wd} clatters away across the ground.']];
const BROKE = [[' The bottle breaks on {him}: you\'re holding the neck of it, jagged.', ' Glass everywhere: what\'s left in your hand is jagged.'], [' The bottle breaks over you; {n} holds the jagged neck of it.', ' Glass everywhere: {n} has the broken neck of it now.']];
const KILLED_ARMED = [['you put {w} into {him}, once, and {n} goes down and doesn\'t move', 'you finish it with {w}: {n} folds, and that\'s all', '{w} goes in, and {n} is gone before {he} lands'],
  ['{w} goes in, and the cold comes after it.', 'there\'s {w}, and then there\'s nothing.', 'you feel {w}, and then you don\'t feel anything.']];
const BOTCHED_KILL = [['you go for the kill with {w}; {n} twists, and it goes in the wrong place', 'you drive {w} at {him}; it glances off bone'], ['{n} goes for the kill with {w}; you twist, and it goes in the wrong place', '{n} drives {w} at you; it glances off bone']];

// Covering a blow, by the cover: [ours, theirs].
const COVERED = {
  block: [['and take it on the forearms', 'and it thuds into your arms', 'and eat it on the gloves you haven\'t got'], ['and takes it on the forearms', 'and it thuds into {his} arms', 'and blocks it, just']],
  parry: [['and knock it aside', 'and turn it off your shoulder', 'and slap it wide'], ['and knocks it aside', 'and turns it off a shoulder', 'and slaps it wide']],
  wblock: [['and it rings off {w}', 'and {w} takes it', 'and catch it on {w}'], ['and it rings off {w}', 'and {w} takes it', 'and catches it on {w}']],
  slip: [['and it hisses past your ear', 'and slip it by an inch', 'and it finds air where your head was'], ['and slips it by an inch', 'and it hisses past {his} ear', 'and it finds air where {his} head was']],
};
const EDGE = [' An edge to you.', ' That\'s an opening earned.', ' You bank the opening.'];
const TAKEN = [[' That takes {n}\'s edge away.', ' {n}\'s edge is gone.', ' That evens it: {n}\'s edge, spent for nothing.'],
  [' That takes your edge away.', ' Your edge is gone.', ' Your edge, gone for nothing.']];
const EDGE_THEM = [' An edge to {n}.', ' {n} banks the opening.', ' {n} has one on you now.'];

// What a blow does, as it looks on them (by part and severity) and as it feels on you.
const LOOKS = {
  head: { light: ['{his} head rocks', 'it clips {him} on the cheek', '{n} blinks it away'], solid: ['{his} head snaps back', 'it lands flush on {his} jaw', '{n}\'s eyes water'],
    heavy: ['{his} legs dip under {him}', '{n}\'s head bounces off it', 'it lands with a crack that turns heads across {hall}'], brutal: ['{n} goes stiff and folds', 'the lights go out in {n}\'s eyes for a second', '{n} drops like a coat off a hook'] },
  torso: { light: ['it thumps into {his} ribs', '{n} grunts', 'it lands on {his} chest'], solid: ['the breath goes out of {n} in a grunt', '{n} folds round it a little', 'it sinks into {his} side'],
    heavy: ['{n} doubles up', 'it lifts {n} onto {his} toes', '{n} sags, mouth open, no air'], brutal: ['{n} goes down on one knee, arms round {his} middle', 'something in {n}\'s side gives', '{n} can\'t straighten up'] },
  arm: { light: ['it smacks into {his} arm', '{n} takes it on the arm'], solid: ['{his} arm drops a moment', '{n} shakes the arm out'], heavy: ['{his} arm hangs', '{n} cradles the arm'], brutal: ['{his} arm folds the wrong way', '{n} cries out, the arm useless'] },
  leg: { light: ['it slaps into {his} thigh', '{n} shifts weight off the leg'], solid: ['{his} leg buckles', '{n} hops a step'], heavy: ['{his} leg goes from under {him}', '{n} limps back'], brutal: ['{n} goes down, the leg won\'t hold', '{his} knee folds'] },
};
const FEELS = {
  head: { light: ['Your ears ring.', 'A sting across the cheek.', 'Your eyes water.'], solid: ['Lights go off behind your eyes.', 'Your jaw clicks, and the room tilts.', 'You taste copper.'],
    heavy: ['White, then {mat} very close.', '{Hall} swings round you.', 'Your teeth meet hard; you\'re not sure where your feet are.'], brutal: ['Nothing, for a moment. Then {ceiling}.', 'The world goes out like a light and comes back sideways.', 'Somebody is a long way off, saying your name.'] },
  torso: { light: ['It knocks some wind out of you.', 'A dull thud under the ribs.', 'You feel it in your back teeth.'], solid: ['Your ribs light up.', 'Something low in your side goes hot.', 'The air leaves you in one go.'],
    heavy: ['You can\'t breathe, and then you can, and it hurts.', 'You fold over it before you can stop yourself.', 'It goes through you to the spine.'], brutal: ['Something in your side cracks, and you hear it.', 'Your legs go: there\'s no air anywhere.', 'You\'re on one knee without deciding to be.'] },
  arm: { light: ['Your forearm stings.', 'A knock on the elbow.'], solid: ['Your arm goes dead to the fingers.', 'Pins and needles from elbow to wrist.'], heavy: ['The arm won\'t lift properly.', 'Your hand won\'t close.'], brutal: ['Your arm gives with a sound you\'ll remember.', 'The arm hangs, and the pain arrives late and all at once.'] },
  leg: { light: ['Your thigh stings.', 'A dead patch on the leg.'], solid: ['Your thigh goes to water.', 'The leg nearly folds.'], heavy: ['You can\'t put weight on it.', 'The leg buckles; you stay up by luck.'], brutal: ['The leg goes, and you with it.', 'Your knee folds under you.'] },
};
const THROWN = [['{n} goes over your hip and onto {mat}', 'and {n} hits {mat} flat on {his} back', 'and {n}\'s feet go up and {his} back comes down'],
  ['{mat} comes up to meet you', 'you go over and land flat, and the air leaves', '{floor} hits you along the whole of your back']];
const SHOVED = [['{n} staggers back, off balance', '{n} stumbles a step', '{n} rocks back on {his} heels'], ['you stagger back, off balance', 'you stumble a step', 'you rock back on your heels']];
const LOCKED = [['{n}\'s arm goes up behind {him}, and {n} slaps {mat}', 'you wind {his} arm up until {n} taps', '{n} taps before the elbow does something worse'],
  ['your arm goes up behind you; you tap', 'your elbow\'s about to bend the wrong way: you slap {mat}', 'you tap before the arm decides for you']];
const CHOKED = [['your forearm closes on {n}\'s throat; {n} sags', '{n} claws at your arm, then taps', '{n}\'s face darkens; {n} taps'],
  ['an arm closes on your throat; the room goes grey', 'you claw at the arm, then tap', 'the light narrows to a tunnel; you tap']];
const CIRCLE = ['You circle.', 'Nobody commits.', 'Feet slide on {mat}; you circle.', 'You watch each other over your hands.'];
const STATUS = { staggered: [[' {n} staggers: no footing to throw from.', ' {n} is off balance.', ' {n} sways.'], [' You stagger: no footing to grab from.', ' You\'re off balance.', ' You sway.']],
  dazed: [[' {n} blinks, slow: {his} hands are late.', ' {n} is dazed.', ' {n} shakes {his} head.'], [' You\'re dazed: your hands are slow to come up.', ' The hall swims.', ' You blink, and blink again.']],
  stunned: [[' {n} is out on {his} feet.', ' {n}\'s eyes have gone somewhere else.', ' {n} is stunned.'], [' You\'re seeing two of {n}.', ' You\'re stunned.', ' Nothing answers: arms, legs, nothing.']] };
const RIPOSTE = [['you take it on the forearms and come straight back over the top', 'you slap it aside and counter in the same breath', 'you cover, and answer before {his} hand is home'],
  ['{n} takes it on the forearms and comes straight back over the top', '{n} slaps it aside and counters in the same breath', '{n} covers, and answers before your hand is home']];
const FENDED = [['{n} goes for the throw; you spend your edge and break the grip.', 'you tear {his} grip off and step clear, your edge spent.'],
  ['you go for the throw; {n} breaks your grip, an edge spent.', '{n} tears your grip off and steps clear, an edge spent.']];
const ABSORBED = [['you walk into it, take it on the shoulder and keep coming, your edge spent.', 'you eat it and keep coming, your edge spent.'],
  ['{n} walks into it, takes it and keeps coming, an edge spent.', '{n} eats it and keeps coming, an edge spent.']];

// Fight enders (sim/cqc.js finish()): [ours, theirs], by how, and whether it came off.
const ENDER = {
  knockout: [['{n} is out on {his} feet, and you put {him} away: flush on the jaw, and {he}\'s out before {he} lands', 'you set your feet and finish it; the lights go out in {n}, and {he} falls without putting a hand out', 'one more, all of you behind it: {n} folds straight down and stays there'],
    ['you never see it coming. The floor, then nothing.', 'the world goes out like a light.', 'you don\'t remember landing.']],
  arm: [['you trap {his} arm and turn it until it goes, with a sound like a green branch; {n} screams', 'you lever the arm over your hip and it breaks; {n} goes to {his} knees', 'you lock the elbow and lean: it gives, and so does {n}'],
    ['{n} traps your arm and turns it until it goes; you hear it before you feel it', '{n} levers your arm over a hip, and it breaks', 'your elbow bends the way it doesn\'t, and the pain arrives all at once']],
  leg: [['you drop your weight onto {his} knee, sideways; it gives, and {n} is done', 'you sweep the leg and stamp through it; {n} won\'t stand on that again soon', 'you twist the leg until the knee goes; {n} screams'],
    ['{n} drops onto your knee, sideways, and it gives', '{n} stamps through your leg; it folds the wrong way', 'your knee goes with a pop you feel in your teeth']],
  slam: [['you charge, lift {him} off {his} feet and drive {him} into the floor, all your weight on top', 'you bull into {him}, and {n} goes down flat with you on {him}; {his} head bounces', 'you take {him} off {his} feet and dump {him} onto {his} head and shoulders'],
    ['{n} charges, lifts you, and the floor comes up all at once', '{n} bulls into you and you go down flat, the back of your head first', 'you\'re off your feet, and then the ground is everything']],
};
const BOTCHED = {
  knockout: [['you put everything into it, and it lands, but not clean: {n} stays up, just', 'it lands hard, off-centre, and something gives that shouldn\'t', 'you swing to finish it; it lands, but {n} is still there'],
    ['{n} puts everything into it; it lands, not clean, and something gives', 'it lands hard and wrong', 'it catches you off-centre: you\'re still up, somehow']],
  break: [['you go for the arm and wrench it, but {n} twists out, crying out', 'you get the lock, almost: the arm bends, and {n} rips it free', 'you crank the joint; it doesn\'t go, but it\'ll remember'],
    ['{n} wrenches your arm, and you twist out, just', 'the lock nearly takes; you rip the arm free', '{n} cranks the joint, and it nearly goes']],
  slam: [['you charge, and you both go down in a heap; {n} gets up slower', 'you drive {him} back and down, hard, and land badly yourself', 'you take {him} down, but not the way you meant: {he}\'s hurt, and up'],
    ['{n} charges, and you both go down in a heap', '{n} drives you down hard; you get up, slowly', '{n} takes you down, hard, but you roll']],
};
const KILLED = [' {n} doesn\'t move. {n} isn\'t breathing.', ' {n} lies still, too still. There\'s no breath.', ' {n} doesn\'t get up, and isn\'t going to.'];
const FOUL = [' The hall goes silent. That was a foul.', ' Somebody shouts. Everyone stops: that was a foul.', ' Hale is already moving. That was a foul.'];

const PART = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
// What else a blow did (sim/health.js injuries): [on them, on you].
const INJURED = {
  crack: [[' Something in {n} gives with a crack: {injury}, by the sound of it.', ' {n} goes white: {injury}.'], [' Something gives with a crack you feel in your teeth: {injury}, you\'d bet.', ' A crack, and a new kind of pain: {injury}.']],
  split: [[' {n}\'s skin splits: {injury}, bleeding freely.', ' Blood: {injury}.'], [' Your skin splits: {injury}. Blood runs warm.', ' Warm wet on your face: {injury}.']],
  nose: [[' Blood from {n}\'s nose.', ' {n}\'s nose runs red.'], [' Your nose runs hot: blood.', ' You taste blood at the back of your throat.']],
  cut: [[' The edge opens {n} up: {injury}.', ' {injury}, and blood.'], [' The edge opens you up: {injury}.', ' You feel it later than you see it: {injury}.']],
  fracture: [[' Something in {n} breaks, and {he} knows it: {injury}.', ' A sound like a stick snapping: {injury}.'], [' Something breaks, and you know it: {injury}.', ' A white flash of pain, then a wrongness: {injury}.']],
};

/** Pronouns for someone, from their sheet. */
export const pronouns = (p) => (p?.sex === 'f' ? { he: 'she', him: 'her', his: 'her' } : { he: 'he', him: 'him', his: 'his' });

/** Fill {n}, {he}, {him}, {his} for them; capitalise the first letter. */
// Where it happens: the Farm's hall, or anywhere else (the street, a stairwell): the words for it.
const PLACES = { hall: { mat: 'the mat', hall: 'the hall', ceiling: 'the ceiling', floor: 'the floor' }, street: { mat: 'the pavement', hall: 'the street', ceiling: 'the sky', floor: 'the ground' } };
function fill(text, name, pr, place = 'hall') {
  const P = PLACES[place] ?? PLACES.street;
  const t = text.replace(/\{(mat|hall|ceiling|floor)\}/g, (m, k) => P[k]).replace(/\{(Mat|Hall|Ceiling|Floor)\}/g, (m, k) => P[k.toLowerCase()].replace(/^t/, 'T'))
    .replace(/\{n\}/g, name).replace(/\{he\}/g, pr.he).replace(/\{him\}/g, pr.him).replace(/\{his\}/g, pr.his);
  return (t.charAt(0).toUpperCase() + t.slice(1)).replace(/([.!?] )([a-z])/g, (m, a, b) => a + b.toUpperCase());   // (a name like 'the FSB man' starting a sentence)
}

/** The exchange `out` (sim/cqc.js resolve()) in words, from our side. name: theirs; p: their sheet. */
export function exchangeText(out, name, p, salt = 0, place = 'hall') {
  const pick = (list, k = 0) => list[hash(out.round, salt, k) % list.length];
  const pr = pronouns(p);
  const us = out.by === 'a';
  const wOf = (side) => { const w = weaponOf(out.arms?.[side]); return w ? `${side === 'a' ? 'your' : 'the'} ${bare(w)}` : 'it'; };
  const does = (side) => { const t = out.tech[side] ?? (side === 'a' ? out.ours : out.theirs); return pick((ARMED[t] ?? DOES[t] ?? DOES.block)[side === 'a' ? 0 : 1], side === 'a' ? 1 : 2).replace(/\{w\}/g, wOf(side)); };
  let text;
  switch (out.kind) {
    case 'circle': text = `${does('b')}; ${does('a')}. ${pick(CIRCLE, 3)}`; break;
    case 'blocked': {
      const cover = us ? out.tech.a : out.tech.b;
      text = us ? `${does('b')}; ${does('a')}, ${pick((COVERED[cover] ?? COVERED.block)[0], 4).replace(/\{w\}/g, wOf('a'))}.${out.gained === 'a' ? pick(EDGE, 5) : out.taken === 'b' ? pick(TAKEN[0], 5) : ''}`
        : `${does('a')}; ${does('b')}, ${pick((COVERED[cover] ?? COVERED.block)[1], 4).replace(/\{w\}/g, wOf('b'))}.${out.gained === 'b' ? pick(EDGE_THEM, 5) : out.taken === 'a' ? pick(TAKEN[1], 5) : ''}`;
      break;
    }
    case 'landed': {
      const part = PART[out.part], s = sev(out.force);
      // (the winner's move last, so 'it lands' is theirs; two hits, whose was first)
      const both = out.ours === 'hit' && out.theirs === 'hit';
      text = us ? `${does('b')}; ${does('a')}, and ${both ? 'yours lands first: ' : ''}${pick(LOOKS[part][s], 6)}.${out.spent.a ? ' Your edge spent: it lands double.' : ''}`
        : `${does('a')}; ${does('b')}, and ${both ? `{his} lands first` : 'it lands'}. ${pick(FEELS[part][s], 6)}${out.spent.b ? ' {n} spent an edge on that one.' : ''}`;
      break;
    }
    case 'riposte': {
      const part = PART[out.part], s = sev(out.force);
      text = us ? `${does('b')}; ${pick(RIPOSTE[0], 6)}, and ${pick(LOOKS[part][s], 7)}. Your edge kept.` : `${does('a')}; ${pick(RIPOSTE[1], 6)}. ${pick(FEELS[part][s], 7)}`;
      break;
    }
    case 'thrown': text = us ? `${does('b')}; ${does('a')}, and ${pick(THROWN[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(THROWN[1], 7)}. ${pick(FEELS.torso[sev(out.force)], 8)}`; break;
    case 'shoved': text = us ? `${does('b')}; ${does('a')}, and ${pick(SHOVED[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(SHOVED[1], 7)}.`; break;
    case 'locked': text = us ? `${does('b')}; ${does('a')}, and ${pick(LOCKED[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(LOCKED[1], 7)}. ${pick(FEELS.arm[sev(out.force)], 8)}`; break;
    case 'choked': text = us ? `${does('b')}; ${does('a')}, and ${pick(CHOKED[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(CHOKED[1], 7)}.`; break;
    case 'killed': text = us ? `${pick(KILLED_ARMED[0], 6).replace(/\{w\}/g, wOf('a'))}.` : pick(KILLED_ARMED[1], 6).replace(/\{w\}/g, wOf('b')); break;
    case 'fumbled': text = us ? `${does('b')}; ${pick(FUMBLED[0], 6).replace(/\{w\}/g, wOf('a'))}.` : `${does('a')}; ${pick(FUMBLED[1], 6).replace(/\{w\}/g, wOf('b'))}.`; break;
    case 'knockout': case 'slammed': case 'broken': {
      const which = out.kind === 'knockout' ? 'knockout' : out.kind === 'slammed' ? 'slam' : PART[out.part] === 'leg' ? 'leg' : 'arm';
      text = us ? `${pick(ENDER[which][0], 6)}.` : `${pick(ENDER[which][1], 6)}`;
      break;
    }
    case 'botched': {
      const part = PART[out.part], s = sev(out.force);
      const lines = out.finish.how === 'kill' ? BOTCHED_KILL : BOTCHED[out.finish.how];
      text = us ? `${pick(lines[0], 6).replace(/\{w\}/g, wOf('a'))}; ${pick(LOOKS[part][s], 7)}.` : `${pick(lines[1], 6).replace(/\{w\}/g, wOf('b'))}. ${pick(FEELS[part][s], 7)}`;
      break;
    }
    case 'fended': text = us ? pick(FENDED[1], 7) : pick(FENDED[0], 7); break;
    case 'absorbed': text = us ? pick(ABSORBED[1], 7) : pick(ABSORBED[0], 7); break;
    default: text = `${does('b')}; ${does('a')}.`;
  }
  for (const i of out.injuries ?? []) text += INJURED[i.kind] ? pick(INJURED[i.kind][us ? 0 : 1], 10).replace('{injury}', i.name) : ` ${i.name.charAt(0).toUpperCase()}${i.name.slice(1)}.`;
  // (a blade or a weapon through the guard; a block clean of it; a weapon knocked away; a bottle broken)
  if (out.through) text += out.through.injuries.length ? out.through.injuries.map(i => pick(THROUGH[us ? 0 : 1], 13).replace('{injury}', i.name)).join('') : pick(BRUISED[us ? 0 : 1], 13);
  else if (out.clean === 'block') text += pick(CLEAN[us ? 0 : 1], 13);
  if (out.dropped) text += pick(DROPPED[out.dropped.side === 'a' ? 0 : 1], 14).replace('{wd}', bare(weaponOf(out.dropped.kind)));
  if (out.broke) text += pick(BROKE[out.broke.side === 'a' ? 0 : 1], 15);
  if (out.killed && us && out.kind !== 'killed') text += pick(KILLED, 11);
  if (out.foul) text += pick(FOUL, 12);
  for (const side of ['a', 'b']) {
    const st = out.status[side];
    if (st && !(st === 'staggered' && out.kind === 'shoved')) text += pick(STATUS[st][side === 'a' ? 1 : 0], 9);   // (a shove says so itself)
  }
  return fill(text, name, pr, place);
}
