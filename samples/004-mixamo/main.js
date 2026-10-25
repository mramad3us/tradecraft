// TRADECRAFT sample 004: the Mixamo animation library (tools/blender/animlib.py → assets/anim/mixamo.glb),
// played on a person made with MPFB's mixamo rig: one library, re-based onto any body
// (samples/lib/anim.js). The page is the shared motion review (samples/lib/motion-view.js).
import { motionView } from '../lib/motion-view.js';

await motionView({ person: './person.glb', library: '../../assets/anim/mixamo.glb',
  ghosts: '../../assets/anim/mixamo.motion.json', checks: '../../assets/anim/mixamo.checks.json' });
