// TRADECRAFT sim: skills, classes and the one formula for a skill's value (docs/DESIGN.md, Characters).
//
// No attributes, only skills, plus the class's over-skill. A skill on a sheet is [trained base,
// practice]: the base from 0 (untrained) to 20 (master) in steps of training (TRAINED), practice 0–3
// on top (rust takes it back). The over-skill (0–100) multiplies the skills that matter to the class,
// each by its weight:
//     value = (base + practice) × (1 + weight × over-skill / 100), rounded
// so a master's practised skill under a full over-skill at weight 1 reaches 46. Civilians have no
// over-skill: their skills are the plain sum, which keeps them low (0–8).
//
// Tradecraft's weights are the design's (my call, to be tuned in playtests). The other classes' tables
// are settled when they're needed (DESIGN.md, Open questions); until then their over-skill
// multiplies nothing. The skill list is data, so it can grow or merge.

export const SKILLS = {
  deception: { name: 'Deception', about: 'Blending in, staying unseen, lying, being hard to remember.' },
  tracking: { name: 'Tracking', about: 'Finding a target and keeping them.' },
  pathfinding: { name: 'Pathfinding', about: 'Spotting a tail and losing it.' },
  awareness: { name: 'Awareness', about: 'Noticing.' },
  social: { name: 'Social', about: 'Reading people and working them.' },
  analysis: { name: 'Analysis', about: 'How smart we really are.' },
  tech: { name: 'Tech', about: 'SIGINT and devices.' },
  medicine: { name: 'Medicine', about: 'Wounds and their care.' },
  cqc: { name: 'CQC', about: 'Fighting hand to hand.' },
  weapons: { name: 'Weapon handling', about: 'Guns.' },
  fitness: { name: 'Fitness', about: 'The body.' },
};

export const CLASSES = {
  spook: { name: 'Spook', overskill: 'Tradecraft', weights: {
    deception: 1, tracking: 1, pathfinding: 1, awareness: 1, social: 0.6, analysis: 0.6, cqc: 0.5, weapons: 0.5 } },
  soldier: { name: 'Soldier', overskill: 'Warfighting', weights: {} },
  cop: { name: 'Cop', overskill: 'Intuition', weights: {} },
  criminal: { name: 'Criminal', overskill: 'Streetwise', weights: {} },
  civilian: { name: 'Civilian', overskill: null, weights: {} },
};

/** Trained bases: the steps of formal training. */
export const TRAINED = { untrained: 0, course: 5, advanced: 10, expert: 15, master: 20 };

/** Language levels, none to native: between them, some words come through. */
export const LANG_LEVELS = ['none', 'basic', 'working', 'fluent', 'native'];

/** A skill's value on a sheet ({ cls, os, skills: { key: [base, practice] }, strain }): strain, what the body's needs cost every skill (sim/campaign.js fatigue()). */
export function skill(sheet, key) {
  const [base = 0, practice = 0] = sheet.skills?.[key] ?? [];
  const w = CLASSES[sheet.cls]?.weights[key] ?? 0;
  return Math.max(0, Math.round((base + practice) * (1 + w * (sheet.os ?? 0) / 100)) + (sheet.strain ?? 0));
}
