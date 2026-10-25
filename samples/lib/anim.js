// TRADECRAFT samples: playing an animation library (tools/blender/animlib.py) on any person made with
// the same rig.
//
// A glTF clip stores each bone's whole local rotation, the library skeleton's rest pose included, and
// every MPFB body's skeleton is fitted to its own proportions, so its rest pose differs a little. So a
// clip is re-based before it plays: each bone's rotation away from the library's rest is put on top
// of the person's own rest,
//     q_person = rest_person · rest_library⁻¹ · q_library
// and the hips' travel is scaled by the ratio of the two skeletons' thigh + shin lengths, around the
// person's own rest hips. Bones are matched by name (GLTFLoader's sanitised names, the same in both).
import * as THREE from 'three';

const rests = (root) => {
  const m = new Map();
  root.traverse(o => { m.set(o.name, { q: o.quaternion.clone(), p: o.position.clone(), node: o }); });
  return m;
};

function legLength(root, names) {
  root.updateMatrixWorld(true);
  const at = (n) => root.getObjectByName(n)?.getWorldPosition(new THREE.Vector3());
  const [up, knee, foot] = names.map(at);
  return up && knee && foot ? up.distanceTo(knee) + knee.distanceTo(foot) : 1;
}

/** The skeleton's naming: Mixamo (mixamorig…) or CMU, found from the hips' name. */
export function skeletonOf(root) {
  if (root.getObjectByName('mixamorigHips')) {
    const m = (s) => 'mixamorig' + s;
    return { hips: m('Hips'), leg: [m('LeftUpLeg'), m('LeftLeg'), m('LeftFoot')],
      feet: [[m('LeftFoot'), m('LeftToeBase')], [m('RightFoot'), m('RightToeBase')]] };
  }
  return { hips: 'Hips', leg: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'], feet: [['LeftFoot', 'LeftToeBase'], ['RightFoot', 'RightToeBase']] };
}

/**
 * The library's clips, re-based for `person` (both loaded scenes). Returns new AnimationClips; the
 * library's are left as they are, so one library serves any number of people.
 */
export function rebaseClips(libraryScene, clips, person) {
  const sk = skeletonOf(person);
  const lib = rests(libraryScene), me = rests(person);
  const ratio = legLength(person, sk.leg) / legLength(libraryScene, sk.leg);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  return clips.map(clip => {
    const tracks = clip.tracks.map(tr => {
      const [node, prop] = [tr.name.slice(0, tr.name.lastIndexOf('.')), tr.name.slice(tr.name.lastIndexOf('.') + 1)];
      const L = lib.get(node), P = me.get(node);
      if (!L || !P) return null;
      const t = tr.clone();
      const v = t.values;
      if (prop === 'quaternion') {
        const fix = P.q.clone().multiply(L.q.clone().invert());          // rest_person · rest_library⁻¹
        for (let i = 0; i < v.length; i += 4) {
          qa.fromArray(v, i);
          qb.copy(fix).multiply(qa).toArray(v, i);
        }
      } else if (prop === 'position') {
        if (node !== sk.hips) return null;                             // only the hips travel
        for (let i = 0; i < v.length; i += 3) {
          for (let a = 0; a < 3; a++) v[i + a] = P.p.getComponent(a) + (v[i + a] - L.p.getComponent(a)) * ratio;
        }
      } else {
        return null;                                                   // no scale tracks
      }
      return t;
    }).filter(Boolean);
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });
}
