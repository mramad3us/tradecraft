// TRADECRAFT sample 003: a building from the kit. A three-storey corner block assembled at runtime
// (samples/lib/building.js) with windows, doors, a shopfront, balconies and stairs from the Blender
// kit (assets/kit/kit.glb), on a cobbled pavement by an asphalt street; one person walks outside,
// another talks upstairs (samples/lib/street.js builds it all).
//   ?walls=up|cut|down   the cutaway (default cut: the walls facing the camera drop to stubs)
//   ?storey=0|1|2        the highest storey shown (default the top)
//   ?t=<s>               freeze the people at that moment
import { createStage, params, ready } from '../lib/stage.js';
import { street } from '../lib/street.js';
import { loaded } from '../lib/materials.js';

const stage = createStage({ background: 0x15171c, groundSize: 80 });
const { THREE, renderer, scene, camera, sun } = stage;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
camera.position.set(19, 21, 22);
camera.lookAt(0, 2.5, 0);
sun.position.set(-8, 18, 10);
sun.target.position.set(0, 0, 0);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 60 });
sun.shadow.camera.updateProjectionMatrix();

const st = await street(stage, {
  walls: params.get('walls') || 'cut', storey: Number(params.get('storey') ?? 2),
  t: params.has('t') ? Number(params.get('t')) : null,
});
await loaded(() => renderer.render(scene, camera));
renderer.render(scene, camera);
ready();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { st.update(clock.getDelta()); renderer.render(scene, camera); });
