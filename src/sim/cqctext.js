// TRADECRAFT sim: a fight in words (sim/cqc.js; the user, 2026-10-26: "the flavour text needs to also
// have many variations", "damage taken should also have more flavour about the pain").
//
// exchangeText() tells an exchange from our side: what each did (by technique: a beginner's swing is
// not an expert's elbow), what came of it, and what it did to the body: theirs as it looks from here,
// ours as it feels, by the part and how hard (SEVERITY: the blow as a share of what the part can
// take). Lines are picked by a hash of the fight's round, never by the dice, so words never move a
// roll. {n} is their name, {he}/{him}/{his} their pronouns (the character's).
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
  block: [['you cover', 'you put your forearms up', 'you tuck in behind your hands'], ['{n} covers', '{n} gets the forearms up', '{n} tucks in behind both hands']],
  parry: [['you wait for it, hands loose', 'you set to parry', 'you keep your hands soft, ready'], ['{n} waits, hands loose', '{n} sets to parry', '{n} keeps the hands soft']],
  slip: [['you stay loose, chin down', 'you weave, ready to slip it', 'you sit back on your heels'], ['{n} stays loose, chin down', '{n} weaves', '{n} sits back on the heels, light']],
  open: [['you can\'t make your hands do anything', 'you stand there, dazed', 'your arms don\'t answer'], ['{n} stands there, dazed', '{n}\'s hands hang', '{n} isn\'t there behind the eyes']],
};

// Covering a blow, by the cover: [ours, theirs].
const COVERED = {
  block: [['and take it on the forearms', 'and it thuds into your arms', 'and eat it on the gloves you haven\'t got'], ['and takes it on the forearms', 'and it thuds into {his} arms', 'and blocks it, just']],
  parry: [['and knock it aside', 'and turn it off your shoulder', 'and slap it wide'], ['and knocks it aside', 'and turns it off a shoulder', 'and slaps it wide']],
  slip: [['and it hisses past your ear', 'and slip it by an inch', 'and it finds air where your head was'], ['and slips it by an inch', 'and it hisses past {his} ear', 'and it finds air where {his} head was']],
};
const EDGE = [' An edge to you.', ' That\'s an opening earned.', ' You bank the opening.'];
const EDGE_THEM = [' An edge to {n}.', ' {n} banks the opening.', ' {n} has one on you now.'];

// What a blow does, as it looks on them (by part and severity) and as it feels on you.
const LOOKS = {
  head: { light: ['{his} head rocks', 'it clips {him} on the cheek', '{n} blinks it away'], solid: ['{his} head snaps back', 'it lands flush on {his} jaw', '{n}\'s eyes water'],
    heavy: ['{his} legs dip under {him}', '{n}\'s head bounces off it', 'it lands with a crack that turns heads across the hall'], brutal: ['{n} goes stiff and folds', 'the lights go out in {n}\'s eyes for a second', '{n} drops like a coat off a hook'] },
  torso: { light: ['it thumps into {his} ribs', '{n} grunts', 'it lands on {his} chest'], solid: ['the breath goes out of {n} in a grunt', '{n} folds round it a little', 'it sinks into {his} side'],
    heavy: ['{n} doubles up', 'it lifts {n} onto {his} toes', '{n} sags, mouth open, no air'], brutal: ['{n} goes down on one knee, arms round {his} middle', 'something in {n}\'s side gives', '{n} can\'t straighten up'] },
  arm: { light: ['it smacks into {his} arm', '{n} takes it on the arm'], solid: ['{his} arm drops a moment', '{n} shakes the arm out'], heavy: ['{his} arm hangs', '{n} cradles the arm'], brutal: ['{his} arm folds the wrong way', '{n} cries out, the arm useless'] },
  leg: { light: ['it slaps into {his} thigh', '{n} shifts weight off the leg'], solid: ['{his} leg buckles', '{n} hops a step'], heavy: ['{his} leg goes from under {him}', '{n} limps back'], brutal: ['{n} goes down, the leg won\'t hold', '{his} knee folds'] },
};
const FEELS = {
  head: { light: ['Your ears ring.', 'A sting across the cheek.', 'Your eyes water.'], solid: ['Lights go off behind your eyes.', 'Your jaw clicks, and the room tilts.', 'You taste copper.'],
    heavy: ['White, then the mat very close.', 'The hall swings round you.', 'Your teeth meet hard; you\'re not sure where your feet are.'], brutal: ['Nothing, for a moment. Then the ceiling.', 'The world goes out like a light and comes back sideways.', 'Somebody is a long way off, saying your name.'] },
  torso: { light: ['It knocks some wind out of you.', 'A dull thud under the ribs.', 'You feel it in your back teeth.'], solid: ['Your ribs light up.', 'Something low in your side goes hot.', 'The air leaves you in one go.'],
    heavy: ['You can\'t breathe, and then you can, and it hurts.', 'You fold over it before you can stop yourself.', 'It goes through you to the spine.'], brutal: ['Something in your side cracks, and you hear it.', 'Your legs go: there\'s no air anywhere.', 'You\'re on one knee without deciding to be.'] },
  arm: { light: ['Your forearm stings.', 'A knock on the elbow.'], solid: ['Your arm goes dead to the fingers.', 'Pins and needles from elbow to wrist.'], heavy: ['The arm won\'t lift properly.', 'Your hand won\'t close.'], brutal: ['Your arm gives with a sound you\'ll remember.', 'The arm hangs, and the pain arrives late and all at once.'] },
  leg: { light: ['Your thigh stings.', 'A dead patch on the leg.'], solid: ['Your thigh goes to water.', 'The leg nearly folds.'], heavy: ['You can\'t put weight on it.', 'The leg buckles; you stay up by luck.'], brutal: ['The leg goes, and you with it.', 'Your knee folds under you.'] },
};
const THROWN = [['{n} goes over your hip and onto the mat', 'and {n} hits the mat flat on {his} back', 'and {n}\'s feet go up and {his} back comes down'],
  ['the mat comes up to meet you', 'you go over and land flat, and the air leaves', 'the floor hits you along the whole of your back']];
const SHOVED = [['{n} staggers back, off balance', '{n} stumbles a step', '{n} rocks back on {his} heels'], ['you stagger back, off balance', 'you stumble a step', 'you rock back on your heels']];
const LOCKED = [['{n}\'s arm goes up behind {him}, and {n} slaps the mat', 'you wind {his} arm up until {n} taps', '{n} taps before the elbow does something worse'],
  ['your arm goes up behind you; you tap', 'your elbow\'s about to bend the wrong way: you slap the mat', 'you tap before the arm decides for you']];
const CHOKED = [['your forearm closes on {n}\'s throat; {n} sags', '{n} claws at your arm, then taps', '{n}\'s face darkens; {n} taps'],
  ['an arm closes on your throat; the room goes grey', 'you claw at the arm, then tap', 'the light narrows to a tunnel; you tap']];
const CIRCLE = ['You circle.', 'Nobody commits.', 'Feet slide on the mat; you circle.', 'You watch each other over your hands.'];
const STATUS = { staggered: [[' {n} staggers.', ' {n} is off balance.', ' {n} sways.'], [' You stagger.', ' You\'re off balance.', ' You sway.']],
  stunned: [[' {n} is out on {his} feet.', ' {n}\'s eyes have gone somewhere else.', ' {n} is dazed.'], [' You\'re seeing two of {n}.', ' You\'re dazed.', ' Your hands won\'t come up.']] };
const FENDED = [['{n} goes for the throw; you spend your edge and break the grip.', 'you tear {his} grip off and step clear, your edge spent.'],
  ['you go for the throw; {n} breaks your grip, an edge spent.', '{n} tears your grip off and steps clear, an edge spent.']];
const ABSORBED = [['you walk into it, take it on the shoulder and keep coming, your edge spent.', 'you eat it and keep coming, your edge spent.'],
  ['{n} walks into it, takes it and keeps coming, an edge spent.', '{n} eats it and keeps coming, an edge spent.']];

const PART = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };

/** Pronouns for someone, from their sheet. */
export const pronouns = (p) => (p?.sex === 'f' ? { he: 'she', him: 'her', his: 'her' } : { he: 'he', him: 'him', his: 'his' });

/** Fill {n}, {he}, {him}, {his} for them; capitalise the first letter. */
function fill(text, name, pr) {
  const t = text.replace(/\{n\}/g, name).replace(/\{he\}/g, pr.he).replace(/\{him\}/g, pr.him).replace(/\{his\}/g, pr.his);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** The exchange `out` (sim/cqc.js resolve()) in words, from our side. name: theirs; p: their sheet. */
export function exchangeText(out, name, p, salt = 0) {
  const pick = (list, k = 0) => list[hash(out.round, salt, k) % list.length];
  const pr = pronouns(p);
  const us = out.by === 'a';
  const does = (side) => { const t = out.tech[side] ?? (side === 'a' ? out.ours : out.theirs); return pick((DOES[t] ?? DOES.block)[side === 'a' ? 0 : 1], side === 'a' ? 1 : 2); };
  let text;
  switch (out.kind) {
    case 'circle': text = `${does('b')}; ${does('a')}. ${pick(CIRCLE, 3)}`; break;
    case 'blocked': {
      const cover = us ? out.tech.a : out.tech.b;
      text = us ? `${does('b')}; ${does('a')}, ${pick((COVERED[cover] ?? COVERED.block)[0], 4)}.${out.gained === 'a' ? pick(EDGE, 5) : ''}`
        : `${does('a')}; ${does('b')}, ${pick((COVERED[cover] ?? COVERED.block)[1], 4)}.${out.gained === 'b' ? pick(EDGE_THEM, 5) : ''}`;
      break;
    }
    case 'landed': {
      const part = PART[out.part], s = sev(out.force);
      text = us ? `${does('b')}; ${does('a')}, and ${pick(LOOKS[part][s], 6)}.${out.spent.a ? ' Your edge spent: it lands double.' : ''}`
        : `${does('b')}; ${does('a')}, and it lands. ${pick(FEELS[part][s], 6)}${out.spent.b ? ' {n} spent an edge on that one.' : ''}`;
      break;
    }
    case 'thrown': text = us ? `${does('b')}; ${does('a')}, and ${pick(THROWN[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(THROWN[1], 7)}. ${pick(FEELS.torso[sev(out.force)], 8)}`; break;
    case 'shoved': text = us ? `${does('b')}; ${does('a')}, and ${pick(SHOVED[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(SHOVED[1], 7)}.`; break;
    case 'locked': text = us ? `${does('b')}; ${does('a')}, and ${pick(LOCKED[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(LOCKED[1], 7)}. ${pick(FEELS.arm[sev(out.force)], 8)}`; break;
    case 'choked': text = us ? `${does('b')}; ${does('a')}, and ${pick(CHOKED[0], 7)}.` : `${does('a')}; ${does('b')}, and ${pick(CHOKED[1], 7)}.`; break;
    case 'fended': text = us ? pick(FENDED[1], 7) : pick(FENDED[0], 7); break;
    case 'absorbed': text = us ? pick(ABSORBED[1], 7) : pick(ABSORBED[0], 7); break;
    default: text = `${does('b')}; ${does('a')}.`;
  }
  for (const side of ['a', 'b']) {
    const st = out.status[side];
    if (st && !(st === 'staggered' && out.kind === 'shoved')) text += pick(STATUS[st][side === 'a' ? 1 : 0], 9);   // (a shove says so itself)
  }
  return fill(text, name, pr);
}
