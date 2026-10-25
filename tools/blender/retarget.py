# TRADECRAFT: put a CMU motion-capture clip (BVH) on an MPFB person's cmu_mb skeleton, as an action.
#
# Used by person.py (--motions). The clip and the skeleton share bone names (cgspeed's conversion was
# made for MotionBuilder, and MPFB's cmu_mb rig follows it), but not a rest pose: the clip rests in
# a T-pose with the legs splayed some 20° outward, MakeHuman in an A-pose with straight legs. Motion
# only transfers like for like, so first the person is put in the clip's rest pose, but only where
# the difference is a pose: the limbs (SWING), parents first, are swung to point the way the clip's
# limbs point at rest. What differs because the two skeletons are built differently is left alone:
# CMU's collarbones point up 15-20° and its hand bones point 90° off the forearm, and copying those
# shrugged our people's shoulders and bent their wrists into flippers (2026-10-25). That's the
# reference. Then each frame, each bone's rotation away from the clip's rest (a delta, in world
# space) is put onto the person's bone as it stands in the reference:
#     wanted(bone) = [clip(bone, frame) · clipRest(bone)⁻¹] · personReference(bone)
# and turned into the pose bone's local rotation, parents first.
#
# check() measures the result against the recording itself (CHECKS): the limbs must point as the
# recording's do, the shoulders rise and fall only as the recording's do, wrists stay near straight,
# fingers curl toward the palm rather than splay. person.py prints it and keeps it in .credits.json.
# The recording's own skeleton is kept too, frame by frame, scaled and placed as the person is (the
# ghost): samples draw it beside the person, so a picture shows what the actor did next to what the
# person does.
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
# A relaxed curl (degrees per bone). The axis isn't guessed: it is the line across the knuckles
# (from the hand towards the thumb, square to the hand), and the sign is the one that moves the
# fingertips toward the palm, which faces down in MakeHuman's rest pose (_curls). A local Z tuned by
# eye on close-ups splayed the fingers sideways instead, and the check caught it (2026-10-25).
CURL = {"FingerBase": 8, "HandFinger1": 40}
# The bones whose rest differs as a pose (T-pose arms, splayed legs), and only those, are aligned.
SWING = {"LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
         "LeftArm", "LeftForeArm", "RightArm", "RightForeArm"}
# The limits check() holds a bake to (degrees). Past one, it's a WARN line, not a silent picture.
CHECKS = {"limbs": 2.0, "shrug": 8.0, "wrist": 30.0, "curl": 0.7, "tilt": 8.0, "clearance": 0.0}
THIGH_M = 0.10      # thigh radius with trousers, for the fingertip clearance (a first estimate)


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


def _curls(rig):
    """Each finger bone's curl as a local rotation: about the knuckle line, toward the palm."""
    rw = rig.matrix_world
    out = {}
    for side, thumb in (("Left", "LThumb"), ("Right", "RThumb")):
        hb = rig.data.bones[side + "Hand"]
        hand = (rw.to_3x3() @ (hb.tail_local - hb.head_local)).normalized()
        t = (rw @ rig.data.bones[thumb].head_local) - (rw @ hb.head_local)
        knuckles = (t - hand * t.dot(hand)).normalized()
        for part, deg in CURL.items():
            fb = rig.data.bones[side + part]
            rest = (rw @ fb.matrix_local).to_quaternion()
            axis = rest.inverted() @ knuckles
            along = rest @ Vector((0, 1, 0))                          # a bone points along its local Y
            best = None
            for sign in (1, -1):
                q = Quaternion(axis, sign * math.radians(deg))
                drop = (rest @ q @ Vector((0, 1, 0))).z - along.z          # palms face down at rest
                if best is None or drop < best[0]:
                    best = (drop, q)
            out[side + part] = best[1]
    return out


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
        if n in SWING and sn in src.data.bones:
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
    curls = _curls(rig)
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
    src_bones = list(src.pose.bones)
    ghost = {"joints": [b.name for b in src_bones],
             "parents": [src_bones.index(b.parent) if b.parent else -1 for b in src_bones],
             "fps": FPS, "frames": []}
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
            if n in curls:
                q = q @ curls[n]
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
        # The ghost: every joint of the recording, scaled and placed like the person, in glTF axes (Y up).
        flat = []
        for sb in src_bones:
            j = ((sw @ sb.head) - origin) * scale
            flat += [round(j.x, 3), round(j.z, 3), round(-j.y, 3)]
        ghost["frames"].append(flat)
        p = (hw - origin) * scale
        pb = rig.pose.bones["Hips"]
        pb.location = hips_rest.matrix_local.inverted() @ (rw.inverted() @ p)
        pb.keyframe_insert("location", frame=k + 1, group="Hips")

    frames = k + 1
    report = check(rig, src, action, a, step, frames)
    bvh_action = src.animation_data.action
    bpy.data.objects.remove(src, do_unlink=True)
    bpy.data.actions.remove(bvh_action)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    return action, frames, report, ghost


def check(rig, src, action, first, step, frames):
    """How the baked motion compares with the recording, every 10th frame (degrees unless noted):
      limbs   the largest angle between a limb's direction on the person and on the recording (0)
      shrug   the most the person's collarbone rises or falls from its own rest beyond what the
              recording's does from its rest (0: shoulders move as the actor's did)
      wrist   the largest bend between forearm and hand (a relaxed wrist: under 30)
      curl    how far the fingers' bend is a curl toward the palm (1) rather than a sideways splay (0)
      lean    the largest torso lean from vertical, person and recording
      tilt    the most the head rolls off level beyond what the recording's does (the user saw a
              tilted head, 2026-10-25)
      clearance  metres between a fingertip and the thigh's surface at the closest (the user saw
              fingers pass into the legs, 2026-10-25): below 0 is inside the leg"""
    rw, sw = rig.matrix_world, src.matrix_world
    tdir = lambda n: (rw @ rig.pose.bones[n].tail) - (rw @ rig.pose.bones[n].head)
    sdir = lambda n: (sw @ src.pose.bones[n].tail) - (sw @ src.pose.bones[n].head)
    rest = lambda arm, w, n: w.to_3x3() @ (arm.data.bones[n].tail_local - arm.data.bones[n].head_local)
    elev = lambda v: math.degrees(math.asin(max(-1.0, min(1.0, v.z / v.length))))
    ang = lambda a, b: math.degrees(a.angle(b)) if a.length > 1e-9 and b.length > 1e-9 else 0.0
    up = Vector((0, 0, 1))
    r = {"limbs": 0.0, "shrug": 0.0, "wrist": 0.0, "curl": 1.0, "lean": [0.0, 0.0], "tilt": 0.0, "clearance": 1.0}
    def roll(arm, w, bone):   # the head's side-to-side axis (bone local X) against level, degrees
        x = (w @ arm.pose.bones[bone].matrix).to_3x3() @ Vector((1, 0, 0))
        return math.degrees(math.asin(max(-1.0, min(1.0, x.normalized().z))))
    def seg(p, a, b):          # distance from point p to segment ab
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (a + ab * t - p).length
    rig.animation_data.action = action
    for k in range(0, frames, 10):
        bpy.context.scene.frame_set(k + 1)
        t = {n: tdir(n).copy() for n in ["LeftShoulder", "RightShoulder", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand",
                                          "LeftHandFinger1", "RightHandFinger1"] + sorted(SWING)}
        t_thumb = {s: (rw @ rig.pose.bones[s + "Thumb"].head) - (rw @ rig.pose.bones[("Left" if s == "L" else "Right") + "Hand"].head) for s in "LR"}
        t_lean = ang((rw @ rig.pose.bones["Neck"].head) - (rw @ rig.pose.bones["Hips"].head), up)
        t_roll = roll(rig, rw, "Head")
        P = lambda n, tail=False: rw @ (rig.pose.bones[n].tail if tail else rig.pose.bones[n].head)
        for side in ("Left", "Right"):
            tip = P(side + "HandFinger1", tail=True)
            near = min(seg(tip, P(f"{s}UpLeg"), P(f"{s}Leg")) for s in ("Left", "Right"))
            r["clearance"] = min(r["clearance"], near - THIGH_M)
        bpy.context.scene.frame_set(first + k * step)
        s_lean = ang((sw @ src.pose.bones["Neck"].head) - (sw @ src.pose.bones["Hips"].head), up)
        r["tilt"] = max(r["tilt"], abs(t_roll) - abs(roll(src, sw, "Head")))
        r["lean"] = [max(r["lean"][0], t_lean), max(r["lean"][1], s_lean)]
        for n in SWING:
            r["limbs"] = max(r["limbs"], ang(t[n], sdir(RENAME.get(n, n))))
        for side in ("Left", "Right"):
            c = side + "Shoulder"
            mine = elev(t[c]) - elev(rest(rig, rw, c))
            theirs = elev(sdir(c)) - elev(rest(src, sw, c))
            r["shrug"] = max(r["shrug"], abs(mine - theirs))
            r["wrist"] = max(r["wrist"], ang(t[side + "ForeArm"], t[side + "Hand"]))
            hand, finger = t[side + "Hand"].normalized(), t[side + "HandFinger1"].normalized()
            if hand.angle(finger) > math.radians(10):
                thumb = t_thumb[side[0]]
                knuckles = (thumb - hand * thumb.dot(hand)).normalized()     # across the knuckles
                axis = hand.cross(finger).normalized()                      # what the fingers turned about
                r["curl"] = min(r["curl"], abs(axis.dot(knuckles)))
    r = {k: ([round(x, 1) for x in v] if isinstance(v, list) else round(v, 2 if k in ("curl", "clearance") else 1)) for k, v in r.items()}
    r["warnings"] = [f"{k} {r[k]} (limit {lim})" for k, lim in CHECKS.items()
                     if (r[k] < lim if k in ("curl", "clearance") else r[k] > lim)]
    return r
