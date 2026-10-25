# TRADECRAFT: put a CMU motion-capture clip (BVH) on an MPFB person's cmu_mb skeleton, as an action.
#
# Used by person.py (--motions). The clip and the skeleton share bone names (cgspeed's conversion was
# made for MotionBuilder, and MPFB's cmu_mb rig follows it), but not a rest pose: the clip rests in
# a T-pose with the legs splayed some 20° outward, MakeHuman in an A-pose with straight legs. Motion
# only transfers like for like, so first the person is put in the clip's own rest pose: each bone,
# parents first, is swung to point the way the clip's bone points at rest (the reference). Then each
# frame, each bone's rotation away from the clip's rest (a delta, in world space) is put onto the
# person's bone as it stands in that reference:
#     wanted(bone) = [clip(bone, frame) · clipRest(bone)⁻¹] · personReference(bone)
# and turned into the pose bone's local rotation, parents first.
#
# The hips also travel: the clip's hip path, scaled by the ratio of the two skeletons' thigh + shin
# lengths (so a stride covers the same ground the feet do), moved to start at the origin. The clip is
# resampled to FPS (CMU records at 120); its first frame, a calibration pose the BVH conversion added,
# is skipped.
import math, re
import bpy
from mathutils import Quaternion, Vector

FPS = 30
RENAME = {"LeftHandFinger1": "LeftHandIndex1", "RightHandFinger1": "RightHandIndex1"}  # person -> clip
# The conversion carries no real hand data (wrist rotations are noise, fingers don't move): the hand
# follows the forearm with a straight wrist, and the fingers rest in a relaxed curl instead.
HANDS = {"LeftHand", "RightHand", "LeftFingerBase", "RightFingerBase", "LeftHandFinger1", "RightHandFinger1",
         "LThumb", "RThumb"}
# A relaxed curl, about each finger bone's local Z (mirrored left and right), tuned by eye on
# close-ups (2026-10-25): +40° bends the right fingers toward the palm, -40° the left.
CURL = {"RightFingerBase": 35, "RightHandFinger1": 35, "LeftFingerBase": -35, "LeftHandFinger1": -35}


def _frame_time(path):
    with open(path) as f:
        m = re.search(r"Frame Time:\s*([0-9.]+)", f.read())
    return float(m.group(1)) if m else 1 / 120


def _ordered(bones):
    """Parents before children."""
    out = []
    def walk(b):
        out.append(b)
        for c in b.children:
            walk(c)
    for b in bones:
        if b.parent is None:
            walk(b)
    return out


def _leg(arm, world):
    """Thigh + shin length: the part of a skeleton that sets how far a step goes."""
    b = arm.data.bones
    head = lambda n: world @ b[n].head_local
    return (head("LeftLeg") - head("LeftUpLeg")).length + (head("LeftFoot") - head("LeftLeg")).length


def _reference(rig, src):
    """World rotations of the person's bones swung to point as the clip's bones do at rest."""
    rw, sw = rig.matrix_world, src.matrix_world
    rest = {b.name: (rw @ b.matrix_local).to_quaternion() for b in rig.data.bones}
    ref, delta = {}, {}
    for bone in _ordered(list(rig.data.bones)):
        n = bone.name
        carried = delta[bone.parent.name] if bone.parent else Quaternion()
        q = carried @ rest[n]
        sn = RENAME.get(n, n)
        if bone.parent is not None and sn in src.data.bones:
            sb = src.data.bones[sn]
            want = sw.to_3x3() @ (sb.tail_local - sb.head_local)
            have = carried @ (rw.to_3x3() @ (bone.tail_local - bone.head_local))
            if want.length > 1e-6 and have.length > 1e-6:
                q = have.rotation_difference(want) @ q
        ref[n] = q
        delta[n] = q @ rest[n].inverted()
    return ref


def retarget(rig, bvh_path, name, start_s=0.0, end_s=None):
    """Bake the clip (or a slice of it, in seconds) onto rig as a new action called name."""
    bpy.ops.import_anim.bvh(filepath=bvh_path, global_scale=1.0, frame_start=1, use_fps_scale=False,
                            update_scene_fps=False, update_scene_duration=False, rotate_mode="NATIVE",
                            axis_forward="-Z", axis_up="Y")
    src = bpy.context.object
    src.animation_data.action.name = "bvh." + name    # keep `name` free for the baked action
    bpy.context.scene.render.fps = FPS                # the exporter samples actions at the scene's rate
    bpy.context.scene.render.fps_base = 1
    sw = src.matrix_world
    s_rest = {b.name: (sw @ b.matrix_local).to_quaternion() for b in src.data.bones}
    t_ref = _reference(rig, src)
    scale = _leg(rig, rig.matrix_world) / _leg(src, sw)

    ft = _frame_time(bvh_path)
    act = src.animation_data.action
    first, last = int(act.frame_range[0]) + 1, int(act.frame_range[1])   # frame 1: calibration pose
    a = first + int(round(start_s / ft))
    b = last if end_s is None else min(last, first + int(round(end_s / ft)))
    step = max(1, int(round((1 / FPS) / ft)))

    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action

    rw = rig.matrix_world
    rwq = rw.to_quaternion()
    order = _ordered(list(rig.data.bones))
    hips_rest = rig.data.bones["Hips"]
    origin = None
    prev = {}
    k = -1
    for k, f in enumerate(range(a, b + 1, step)):
        bpy.context.scene.frame_set(f)
        want = {}  # armature-space rotation of each person bone this frame
        for bone in order:
            n = bone.name
            sn = RENAME.get(n, n)
            if sn in src.pose.bones and n not in HANDS:
                delta = (sw @ src.pose.bones[sn].matrix).to_quaternion() @ s_rest[sn].inverted()
                want[n] = rwq.inverted() @ (delta @ t_ref[n])
            elif bone.parent is not None:
                # no counterpart in the clip: keep its reference relation to its parent
                rel = (rwq.inverted() @ t_ref[bone.parent.name]).inverted() @ (rwq.inverted() @ t_ref[n])
                want[n] = want[bone.parent.name] @ rel
            else:
                want[n] = rwq.inverted() @ t_ref[n]
            if bone.parent is None:
                q = bone.matrix_local.to_quaternion().inverted() @ want[n]
            else:
                rest_rel = (bone.parent.matrix_local.inverted() @ bone.matrix_local).to_quaternion()
                q = rest_rel.inverted() @ want[bone.parent.name].inverted() @ want[n]
            if n in CURL:
                q = q @ Quaternion(Vector((0, 0, 1)), math.radians(CURL[n]))
            if n in prev and prev[n].dot(q) < 0:
                q.negate()  # keep the quaternion path continuous
            prev[n] = q
            pb = rig.pose.bones[n]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=k + 1, group=n)

        # The hips' path: world position, scaled, starting at the origin (height kept).
        hw = sw @ src.pose.bones["Hips"].head
        if origin is None:
            origin = Vector((hw.x, hw.y, 0.0))
        p = (hw - origin) * scale
        pb = rig.pose.bones["Hips"]
        pb.location = hips_rest.matrix_local.inverted() @ (rw.inverted() @ p)
        pb.keyframe_insert("location", frame=k + 1, group="Hips")

    frames = k + 1
    bvh_action = src.animation_data.action
    bpy.data.objects.remove(src, do_unlink=True)
    bpy.data.actions.remove(bvh_action)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    return action, frames
