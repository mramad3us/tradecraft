// TRADECRAFT sim: the words for how a scene ended, on its paper's stamp and on the debrief's title (the
// user, 2026-11-03: "'seen' could read as 'we were seen' and not 'we have seen them do the thing'"): what the
// character knows, said so it reads only one way. (A meeting met clean and one met under watching eyes are
// both "met": the character doesn't know which, DESIGN.md "We only know what we know".)
export const OUTCOME_WORDS = {
  sdr: { clean: 'met', burned: 'met', right: 'called off', needless: 'called off', missed: 'missed him', incident: 'an incident' },
  tail: { seen: 'meeting observed', made: 'you were made', spooked: 'he was spooked', lost: 'lost him', missed: 'meeting missed', blown: 'cover blown' },
  watch: { photo: 'photographed', soft: 'a soft print', seen: 'seen, not photographed', missed: 'meeting missed', blown: 'you were made' },
  extract: { out: 'brought out', taken: 'taken', killed: 'killed', captured: 'you were taken', dead: 'you died', bolted: 'lost: they ran', lost: 'lost in the streets', stranded: 'the car gone', missed: 'never met', unread: 'the word never read' },
};
/** How a scene of this kind ended, in words ('meeting observed'), or the outcome as it is. */
export const outcomeWord = (kind, outcome) => OUTCOME_WORDS[kind]?.[outcome] ?? String(outcome ?? 'over');
