// TRADECRAFT sample 005: looks. The street from sample 003 (samples/lib/street.js), rendered by each
// look in samples/lib/looks.js, so they're compared on the same scene.
//   ?look=real|pixel|pixel-chunky|toon|flat
//   ?heads=1.5           bigger heads (chibi)
//   ?frame=block|street  the whole block, or close on the pavement
//   ?walls / ?storey     the building's cutaway;  ?t=<s> freezes the people
import { createStage, params, ready } from '../lib/stage.js';
import { street } from '../lib/street.js';
import { loaded } from '../lib/materials.js';
import { applyLook } from '../lib/looks.js';

const stage = createStage({ background: 0x2a2d33, groundSize: 80 });
const { THREE, renderer, scene, camera, sun } = stage;
// ?frame=block (the whole corner block) | street (close on the pavement, where a person reads).
const close = params.get('frame') === 'street';
const target = close ? new THREE.Vector3(-1.2, 1.4, 4.6) : new THREE.Vector3(0, 2.5, 0);
const offset = new THREE.Vector3(19, 18.5, 22).normalize().multiplyScalar(close ? 17 : 34);
camera.position.copy(target).add(offset);
camera.lookAt(target);
sun.position.set(-8, 18, 10);
sun.target.position.set(0, 0, 0);
sun.intensity = 2.6;
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 60 });
sun.shadow.camera.updateProjectionMatrix();

const st = await street(stage, {
  walls: params.get('walls') || 'cut', storey: Number(params.get('storey') ?? 2),
  t: params.has('t') ? Number(params.get('t')) : null, heads: Number(params.get('heads') || 1),
});
await loaded(() => renderer.render(scene, camera));
const look = applyLook(params.get('look') || 'pixel', stage, { target });
st.building.update(look.camera, st.view);
look.render();
ready();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { st.update(clock.getDelta()); look.render(); });
