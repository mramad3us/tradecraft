// Experience (sim/xp.js): Tradecraft grows of XP, a point at a time and each dearer than the last; an
// assignment's XP by its kind, how it went, how hard and how risky; a team shaken off; a roll gone your way.
import { cost, missionXP, gain, level, progress, fromRoll, LOST_XP, ROLL_XP } from '../src/sim/xp.js';
import { newCampaign, candidates, fold } from '../src/sim/campaign.js';
import { cityById } from '../src/sim/cities/index.js';
import { assert, fmt } from './helpers.mjs';

export default [
  {
    name: 'xp: a point costs more the higher you are; a beginner gains one from a tail, an officer needs four or five, a legend barely moves',
    fn() {
      assert(cost(20) === 8 && cost(40) === 50 && cost(95) > 5000, `the costs: 20 ${cost(20)}, 40 ${cost(40)}, 60 ${cost(60)}, 80 ${cost(80)}, 95 ${cost(95)}`);
      const tail = (city) => missionXP({ kind: 'tail', outcome: 'seen', craft: 'trained', risk: cityById(city).station.risk, heat: 20 }) + 30 * ROLL_XP;   // (and the rolls on the way)
      const per = (os, city) => cost(os) / tail(city);
      assert(per(20, 'london') <= 1, `a beginner in London: a point a tail (${fmt(per(20, 'london'), 2)} tails a point)`);
      assert(per(40, 'london') > 3.5 && per(40, 'london') < 6, `an officer at 40 in London: four or five tails a point (${fmt(per(40, 'london'), 1)})`);
      assert(per(40, 'moscow') < per(40, 'london'), 'riskier Moscow teaches faster');
      const legend = { os: 95, xp: 0 };
      gain(legend, tail('london') * 20); level(legend);
      assert(legend.os === 95, 'twenty tails, and a legend is still 95');
      console.log(`      a point: ${[20, 30, 40, 60, 80, 95].map(o => `${o}: ${cost(o)} XP`).join(', ')}; tails a point (a trained man, done well, London / Moscow): ${[20, 40, 60].map(o => `at ${o} ${fmt(per(o, 'london'), 1)} / ${fmt(per(o, 'moscow'), 1)}`).join('; ')}`);
    },
  },
  {
    name: 'xp: how it went, how hard, how risky; a covert team shaken off is worth more than an evening nobody followed you',
    fn() {
      const m = (o) => missionXP({ kind: 'sdr', risk: 1.4, heat: 20, ...o });
      assert(m({ outcome: 'clean', team: 'covert' }) > m({ outcome: 'clean', team: 'none' }), 'a meeting under a covert team, harder: more');
      assert(m({ outcome: 'clean' }) > m({ outcome: 'needless' }) && m({ outcome: 'right' }) > m({ outcome: 'needless' }), 'called off rightly beats called off for nothing');
      assert(LOST_XP.covert > m({ outcome: 'clean' }) * 0.5, 'shaking a covert team teaches a lot');
      assert(missionXP({ kind: 'tail', outcome: 'seen', craft: 'sharp', risk: 1 }) > missionXP({ kind: 'tail', outcome: 'seen', craft: 'careless', risk: 1 }), 'a sharp target, more');
      const p = { os: 40, xp: 0 }, state = { player: 'me', people: { me: p } };
      fromRoll(state, { roll: { kind: 'check', ok: true } }); fromRoll(state, { roll: { kind: 'check', ok: false } }); fromRoll(state, { roll: { kind: 'opposed', ok: true, them: true } }); fromRoll(state, { roll: { kind: 'check', ok: true }, hidden: true });
      assert(p.xp === ROLL_XP, `a roll of yours gone your way, a little; theirs, and the unseen, nothing (${p.xp})`);
      console.log(`      an asset meeting in Moscow: clean ${m({ outcome: 'clean' })}, under an overt pair ${m({ outcome: 'clean', team: 'overt' })}, a covert team ${m({ outcome: 'clean', team: 'covert' })} XP; called off rightly ${m({ outcome: 'right' })}, for nothing ${m({ outcome: 'needless' })}; a team shaken off +${LOST_XP.overt} / +${LOST_XP.covert}; a roll +${ROLL_XP}`);
    },
  },
  {
    name: 'xp: the debrief says it, and a beginner\'s first tour lifts them a point a good evening',
    fn() {
      const p0 = candidates(3, 'london', 'junior')[0], C = newCampaign(3, p0, 'london', 'junior'), was = p0.os, t = C.posting.targets[0];
      const paper = fold(C, { id: 'x', kind: 'tail', who: t.id, status: 'open' }, { outcome: 'seen', sightings: [] }, C.character, C.posting.startMs);
      assert(was >= 16 && was <= 26, `a beginner starts round 20 (${was})`);
      assert(C.character.os === was + 1 || C.character.xp > 0, `a tail seen: ${paper.lines[0]}`);
      console.log(`      ${p0.name} (Tradecraft ${was}): ${paper.lines[0]}`);
    },
  },
];
