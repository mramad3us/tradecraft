// TRADECRAFT sim: Hale's exercises as the campaign books them (sim/campaign.js bookLessons(); the lessons themselves,
// their scenes, steps and Hale's words, are sim/tutorial/). Data only, so the places (sim/places.js) and the campaign
// can both read it without reading each other.
//
// Each: its id (the tutorial's), its title, the kind of scene it is for when it begins (scene: a tail's, begun at a
// door at its hour; a meeting's, a while before; a photograph's, a little before), where it's walked to (place: a
// door on the posting's streets; a bench; a café; or the door its scene is laid out from, on the street the posting
// counts as row 0: Blown's block entrance, the umbrella's door), and its hour (h: when he comes out, the meeting, the
// photograph's, the phone's two rings).
export const LESSON_BOOK = [
  { id: 'tailing', title: 'Tailing a man', scene: 'tail', place: 'door', h: 16.5 },
  { id: 'tailed', title: 'Being tailed', scene: 'sdr', place: 'bench', h: 19 },
  { id: 'watching', title: 'Watching and photographing', scene: 'watch', place: 'cafe', h: 13 },
  { id: 'brush', title: 'A brush pass', scene: 'sdr', place: 'bench', h: 18.5 },
  { id: 'drop', title: 'A dead drop', scene: 'sdr', place: 'bench', h: 15 },
  { id: 'blown', title: 'Blown', scene: 'tail', place: 'entrance0', h: 18.75 },
  { id: 'umbrella', title: 'The umbrella', scene: 'tail', place: 'door0', h: 18 },
];
export const lessonBook = (id) => LESSON_BOOK.find(l => l.id === id) ?? null;
/** The kind of scene an assignment is, for where it's walked to and when it begins: a lesson's, its scene's. */
export const sceneOf = (a) => (a.kind === 'lesson' ? lessonBook(a.lesson)?.scene ?? 'tail' : a.kind);
