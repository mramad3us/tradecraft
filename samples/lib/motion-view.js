// TRADECRAFT samples: the motion review page, shared by every motion sample. A person (and, if given,
// an animation library re-based onto them, samples/lib/anim.js) under the iso camera, which follows
// the hips; buttons pick the clip.
//   ?clip=<name>          start on that clip
//   ?t=<seconds>          freeze at that moment (for screenshots)
//   ?strip=t1,t2,…        a filmstrip: the clip at each moment, side by side, in one picture
//   ?orbit=how,dist,up    a close camera circling the hips (or a bone, &focus=<bone>); how is a number
//                         of degrees (0 looks from +z) or front | side | back, read from the motion
//   ?ghost=beside|over    the recording's own skeleton, in orange, beside the person or on top: what the
//                         actor did, next to what the person does
//   ?bones                the person's own skeleton, in cyan
//   ?check                window.__report: each clip's speed, facing, foot slide, and its pose check
//                         against the recording (made by person.py or animlib.py)
// The grid on the ground is a metre square: feet should plant on it, not slide.
import { createStage, loadModel, params, ready } from './stage.js';
import { rebaseClips, skeletonOf } from './anim.js';

export async function motionView({ person, library, ghosts: ghostsUrl, checks: checksUrl }) {
  const { THREE, renderer, scene, camera, follow } = createStage({ grid: true });
  const gltf = await loadModel(params.get('model') || person);
  scene.add(gltf.scene);
  const sk = skeletonOf(gltf.scene);

  let clips = gltf.animations;
  if (library) {
    const lib = await loadModel(library);
    clips = rebaseClips(lib.scene, lib.animations, gltf.scene);
  }
  const mixer = new THREE.AnimationMixer(gltf.scene);
  let action = null;
  const hips = gltf.scene.getObjectByName(sk.hips);
  const hipsAt = new THREE.Vector3();
  const ui = document.getElementById('ui');
  const play = (clip) => {
    action?.stop();
    action = mixer.clipAction(clip).play();
    ui.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === clip.name));
  };
  for (const c of clips) {
    const b = document.createElement('button');
    b.textContent = c.name;
    b.onclick = () => play(c);
    ui.appendChild(b);
  }
  play(clips.find(c => c.name === params.get('clip')) || clips[0]);

  // The ghost: the recording's joints, frame by frame, drawn as lines from each joint to its parent.
  const GHOST_SIDE = 0.75;
  const ghosts = params.has('ghost') && ghostsUrl ? await (await fetch(ghostsUrl)).json() : null;
  const ghostLines = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffa040, depthTest: false, transparent: true }));
  ghostLines.renderOrder = 10;
  scene.add(ghostLines);
  const ghostAt = (t) => {
    const g = ghosts?.[action.getClip().name];
    ghostLines.visible = !!g;
    if (!g) return;
    const f = g.frames[Math.max(0, Math.min(g.frames.length - 1, Math.round(t * g.fps)))];
    // Beside: GHOST_SIDE to the camera's right, so it stands next to the person in the picture.
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize().multiplyScalar(GHOST_SIDE);
    const side = params.get('ghost') === 'over' ? [0, 0] : [right.x, right.z];
    const pts = [];
    g.parents.forEach((p, i) => {
      if (p < 0) return;
      for (const j of [p, i]) pts.push(f[3 * j] + side[0], f[3 * j + 1], f[3 * j + 2] + side[1]);
    });
    ghostLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  };
  if (params.has('bones')) {
    const helper = new THREE.SkeletonHelper(gltf.scene);
    helper.material.depthTest = false;
    helper.material.color = new THREE.Color(0x40d0ff);
    helper.renderOrder = 11;
    scene.add(helper);
  }

  const orbitRaw = params.get('orbit')?.split(',');
  const orbit = orbitRaw && [orbitRaw[0], ...orbitRaw.slice(1).map(Number)];
  const facingDeg = () => {   // the way the clip travels (or, standing, the feet point), as an orbit angle
    const clip = action.getClip(), now = action.time;
    mixer.setTime(0); const a0 = hips.getWorldPosition(new THREE.Vector3());
    mixer.setTime(clip.duration); const a1 = hips.getWorldPosition(new THREE.Vector3());
    mixer.setTime(now);
    const travel = a1.sub(a0).setY(0);
    if (travel.length() > 0.5) return Math.atan2(travel.x, travel.z) * 180 / Math.PI;
    // In place or standing: where the feet point, averaged over the whole clip (a stride swings them).
    const f = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      mixer.setTime(clip.duration * i / 12);
      for (const [foot, toe] of sk.feet) {
        const a = gltf.scene.getObjectByName(foot).getWorldPosition(new THREE.Vector3());
        f.add(gltf.scene.getObjectByName(toe).getWorldPosition(new THREE.Vector3()).sub(a).setY(0).normalize());
      }
    }
    mixer.setTime(now);
    return Math.atan2(f.x, f.z) * 180 / Math.PI;
  };
  const focus = params.get('focus') && gltf.scene.getObjectByName(params.get('focus'));
  const at = (t) => {
    mixer.setTime(t);
    hips.getWorldPosition(hipsAt);
    follow(new THREE.Vector3(hipsAt.x, 0.9, hipsAt.z));
    if (orbit) {
      const [how, dist = 5, up = 0.4] = orbit;
      const named = { front: 0, side: 90, back: 180 };
      const deg = how in named ? facingDeg() + named[how] : Number(how);
      const r = deg * Math.PI / 180;
      const c = focus ? focus.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(hipsAt.x, 1.1, hipsAt.z);
      // Beside a ghost: aim between the person and the ghost, half the ghost's offset to the right.
      if (params.get('ghost') === 'beside') c.add(new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)).multiplyScalar(GHOST_SIDE / 2));
      camera.position.set(c.x + Math.sin(r) * dist, c.y + up, c.z + Math.cos(r) * dist);
      camera.lookAt(c);
    }
    ghostAt(t);
  };

  // ?check: measure every clip, so motion is judged by numbers, not only by eye.
  //   facing  cosine between where the feet point (heel to toe) and where the hips are heading at that
  //           moment (over a quarter second), averaged while moving: 1 is forward, -1 walking backwards
  //   slide   how fast a planted foot (the lower toe, on the ground) moves, in m/s: near 0 is good
  //           (in place, null: the feet's sweep is then the speed the game moves the person at)
  //   speed   the hips' average ground speed, m/s (a walk is about 1.2–1.5)
  if (params.has('check')) {
    const raw = checksUrl ? await (await fetch(checksUrl)).json() : {};
    const pose = raw.clips || Object.fromEntries((raw.motions || []).map(m => [m.clip, m.check]));
    const p = new THREE.Vector3(), q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const bone = n => gltf.scene.getObjectByName(n);
    const [[lfN, ltN], [rfN, rtN]] = sk.feet;
    const lt = bone(ltN), rt = bone(rtN), lf = bone(lfN), rf = bone(rfN);
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
      const dist = end.clone().sub(start).length();
      const sweep = +(slide / Math.max(1, planted)).toFixed(2);
      // In place (the body stays put while the feet step): the planted foot's sweep is the speed the
      // game must move the person at for the feet to hold the ground, not a slide.
      const inPlace = dist < 0.2 && sweep > 0.3;
      return { clip: clip.name, seconds: +clip.duration.toFixed(2), metres: +dist.toFixed(2),
        speed: inPlace ? sweep : +(dist / clip.duration).toFixed(2), inPlace,
        facing: moving ? +(facing / moving).toFixed(2) : null,
        slide: inPlace ? null : sweep, pose: pose[clip.name] };
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
      ghostAt(action.time);
      hips.getWorldPosition(hipsAt);
      follow(new THREE.Vector3(hipsAt.x, 0.9, hipsAt.z));
      renderer.render(scene, camera);
    });
    ready();
  }
}
