// TRADECRAFT sample 001: people in motion, from CMU motion capture baked onto a person by
// tools/blender/person.py (--motions). The page is the shared motion review (samples/lib/motion-view.js:
// its header lists the parameters).
import { motionView } from '../lib/motion-view.js';

await motionView({ person: './person.glb', ghosts: './person.motion.json', checks: './person.credits.json' });
