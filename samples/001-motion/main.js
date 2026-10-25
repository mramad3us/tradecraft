// TRADECRAFT sample 001: people in motion. A person made by tools/blender/person.py, with CMU
// motion-capture clips baked on (--motions), played under the iso camera, which follows the hips.
// Buttons pick the clip.
//   ?clip=<name>          start on that clip
//   ?t=<seconds>          freeze at that moment (for screenshots)
//   ?strip=t1,t2,…        a filmstrip: the clip at each moment, side by side, in one picture
//   ?orbit=deg,dist,up    a close camera circling the hips, or a bone with &focus=<bone>
// The grid on the ground is a metre square: feet should plant on it, not slide.
import { createStage, loadModel, params, ready } from '../lib/stage.js';

const { THREE, renderer, scene, camera, follow } = createStage({ grid: true });
const gltf = await loadModel(params.get('model') || './person.glb');
scene.add(gltf.scene);

const mixer = new THREE.AnimationMixer(gltf.scene);
const clips = gltf.animations;
let action = null;
const hips = gltf.scene.getObjectByName('Hips');
const hipsAt = new THREE.Vector3();
const play = (clip) => {
  action?.stop();
  action = mixer.clipAction(clip).play();
  document.querySelectorAll('#ui button').forEach(b => b.classList.toggle('on', b.textContent === clip.name));
};
const ui = document.getElementById('ui');
for (const c of clips) {
  const b = document.createElement('button');
  b.textContent = c.name;
  b.onclick = () => play(c);
  ui.appendChild(b);
}
play(clips.find(c => c.name === params.get('clip')) || clips[0]);

// ?orbit=deg[,dist[,up]]: a close camera circling a point (0° looks from +z), for faces and hands;
// the point is the hips at chest height, or a bone (?focus=RightHand); up raises the camera over it.
const orbit = params.get('orbit')?.split(',').map(Number);
const focus = params.get('focus') && gltf.scene.getObjectByName(params.get('focus'));
const at = (t) => {
  mixer.setTime(t);
  hips.getWorldPosition(hipsAt);
  follow(new THREE.Vector3(hipsAt.x, 0.9, hipsAt.z));
  if (orbit) {
    const [deg, dist = 5, up = 0.4] = orbit, r = deg * Math.PI / 180;
    const c = focus ? focus.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(hipsAt.x, 1.1, hipsAt.z);
    camera.position.set(c.x + Math.sin(r) * dist, c.y + up, c.z + Math.cos(r) * dist);
    camera.lookAt(c);
  }
};

// ?check: measure every clip, so a retarget is judged by numbers, not only by eye.
//   facing  cosine between where the feet point (heel to toe) and where the hips are heading at that
//           moment (over a quarter second), averaged while moving: 1 is forward, -1 walking backwards
//   slide   how fast a planted foot (the lower toe, on the ground) moves, in m/s: near 0 is good
//   speed   the hips' average ground speed, m/s (a walk is about 1.2–1.5)
if (params.has('check')) {
  const p = new THREE.Vector3(), q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const bone = n => gltf.scene.getObjectByName(n);
  const lt = bone('LeftToeBase'), rt = bone('RightToeBase'), lf = bone('LeftFoot'), rf = bone('RightFoot');
  window.__report = clips.map(clip => {
    play(clip);
    const dt = 1 / 30, n = Math.floor(clip.duration / dt);
    let facing = 0, moving = 0, slide = 0, planted = 0, prevFoot = null, start = null, end = null;
    const hipsAtTime = (t) => { mixer.setTime(Math.max(0, Math.min(clip.duration, t))); return hips.getWorldPosition(new THREE.Vector3()).setY(0); };
    let floor = Infinity;
    for (let i = 0; i <= n; i++) {
      mixer.setTime(i * dt);
      lt.getWorldPosition(a); rt.getWorldPosition(b);
      floor = Math.min(floor, a.y, b.y);
    }
    for (let i = 0; i <= n; i++) {
      const heading = hipsAtTime(i * dt + 0.125).sub(hipsAtTime(i * dt - 0.125));
      mixer.setTime(i * dt);
      hips.getWorldPosition(p); p.y = 0;
      if (!start) start = p.clone(); end = p.clone();
      lt.getWorldPosition(a); rt.getWorldPosition(b);
      const left = a.y < b.y, toe = left ? a.clone() : b.clone();
      (left ? lf : rf).getWorldPosition(q);
      if (heading.length() / 0.25 > 0.4) {                  // moving faster than 0.4 m/s
        facing += toe.clone().sub(q).setY(0).normalize().dot(heading.normalize());
        moving++;
      }
      // Planted: the lower toe, within 3 cm of the lowest it gets in the clip.
      const down = toe.y < floor + 0.03;
      if (down && prevFoot?.down && prevFoot.left === left) { slide += toe.clone().setY(0).distanceTo(prevFoot.at) / dt; planted++; }
      prevFoot = { left, down, at: toe.clone().setY(0) };
    }
    const travel = end.clone().sub(start);
    const dist = travel.length();
    return { clip: clip.name, seconds: +clip.duration.toFixed(2), metres: +dist.toFixed(2),
      speed: +(dist / clip.duration).toFixed(2),
      facing: moving ? +(facing / moving).toFixed(2) : null,
      slide: +(slide / Math.max(1, planted)).toFixed(2) };
  });
}

const strip = params.get('strip')?.split(',').map(Number);
if (strip) {
  // One cell per moment, drawn with the scissor into a single canvas.
  ui.style.display = 'none';
  const n = strip.length, cols = Math.min(n, 6), rows = Math.ceil(n / cols);
  const w = Math.floor(innerWidth / cols), h = Math.floor(innerHeight / rows);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setScissorTest(true);
  strip.forEach((t, i) => {
    const x = (i % cols) * w, y = innerHeight - (Math.floor(i / cols) + 1) * h;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    at(t);
    renderer.render(scene, camera);
  });
  ready();
} else if (params.has('t')) {
  at(Number(params.get('t')));
  renderer.render(scene, camera);
  ready();
} else {
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    mixer.update(clock.getDelta());
    hips.getWorldPosition(hipsAt);
    follow(new THREE.Vector3(hipsAt.x, 0.9, hipsAt.z));
    renderer.render(scene, camera);
  });
  ready();
}
