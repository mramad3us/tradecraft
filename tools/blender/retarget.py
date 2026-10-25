# TRADECRAFT: put a motion clip (CMU BVH, Mixamo FBX) on an MPFB person's skeleton, as an action.
#
# Used by person.py (--motions, CMU) and animlib.py (whole libraries, Mixamo). Each source library is
# a PROFILE: how to load a clip, how its bone names map to the person's, which bones to align, how
# to treat the hands, and the bones check() reads (their roles).
#
# The clip and the skeleton share bone names (or map by RENAME), but not a rest pose: CMU rests in
# a T-pose with the legs splayed some 20°, Mixamo's X Bot in a clean T-pose, MakeHuman in an A-pose.
# Motion only transfers like for like, so first the person is put in the clip's rest pose, but only
# where the difference is a pose: the bones in the profile's SWING set, parents first, are swung to
# point the way the clip's bones point at rest. What differs because the skeletons are built
# differently is left alone: CMU's collarbones point up 15-20° and its hand bones 90° off the
# forearm, and copying those shrugged our people's shoulders and bent their wrists into flippers
# (2026-10-25). That's the reference. Then each frame, each bone's rotation away from the clip's
# rest (a delta, in world space) is put onto the person's bone as it stands in the reference:
#     wanted(bone) = [clip(bone, frame) · clipRest(bone)⁻¹] · personReference(bone)
# and turned into the pose bone's local rotation, parents first.
#
# The hips also travel: the clip's hip path, scaled by the ratio of the two skeletons' thigh + shin
# lengths (so a stride covers the same ground the feet do), moved to start at the origin. Clips are
# resampled to FPS.
#
# check() measures the result against the recording itself (CHECKS): the limbs must point as the
# recording's do, the shoulders rise and fall only as the recording's do, wrists stay near straight,
# fingers curl toward the palm rather than splay, the head doesn't roll more than the actor's, the
# fingertips stay outside the thighs. The recording's own skeleton is kept too, frame by frame,
# scaled and placed as the person is (the ghost), for samples to draw beside the person.
import math, re
import bpy
from mathutils import Quaternion, Vector

FPS = 30
# The limits check() holds a bake to (degrees, metres). Past one, it's a WARN line, not a silent picture.
CHECKS = {"limbs": 2.0, "shrug": 8.0, "wrist": 30.0, "curl": 0.7, "tilt": 8.0, "clearance": 0.0}
THIGH_M = 0.10      # thigh radius with trousers, for the fingertip clearance (a first estimate)


def _load_bvh(path):
    bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, frame_start=1, use_fps_scale=False,
                            update_scene_fps=False, update_scene_duration=False, rotate_mode="NATIVE",
                            axis_forward="-Z", axis_up="Y")
    with open(path) as f:
        m = re.search(r"Frame Time:\s*([0-9.]+)", f.read())
    return bpy.context.object, float(m.group(1)) if m else 1 / 120


def _load_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    for o in new:                      # anything besides the armature (an empty, a mesh) goes
        if o is not arm:
            bpy.data.objects.remove(o, do_unlink=True)
    return arm, 1 / 30                  # Mixamo exports were asked for at 30 fps


def _sides(fmt):
    """Bone names for both sides from a pattern with {S} (Left/Right) or {s} (L/R)."""
    return [fmt.format(S=S, s=S[0]) for S in ("Left", "Right")]


CMU_ROLES = {"hips": "Hips", "neck": "Neck", "head": "Head",
             "clavicle": "{S}Shoulder", "arm": "{S}Arm", "forearm": "{S}ForeArm", "hand": "{S}Hand",
             "finger": "{S}HandFinger1", "fingertip": "{S}HandFinger1", "thumb": "{s}Thumb",
             "upleg": "{S}UpLeg", "leg": "{S}Leg", "foot": "{S}Foot"}
MIX = "mixamorig:"
MIXAMO_ROLES = {"hips": MIX + "Hips", "neck": MIX + "Neck", "head": MIX + "Head",
                "clavicle": MIX + "{S}Shoulder", "arm": MIX + "{S}Arm", "forearm": MIX + "{S}ForeArm",
                "hand": MIX + "{S}Hand", "finger": MIX + "{S}HandMiddle1", "fingertip": MIX + "{S}HandMiddle3",
                "thumb": MIX + "{S}HandThumb1", "upleg": MIX + "{S}UpLeg", "leg": MIX + "{S}Leg", "foot": MIX + "{S}Foot"}
_FINGERS = [f"{f}{i}" for f in ("Thumb", "Index", "Middle", "Ring", "Pinky") for i in (1, 2, 3)]

PROFILES = {
    # CMU via cgspeed's BVH: no real hand data (wrist rotations are noise, fingers never move), so the
    # hand follows the forearm and the fingers take a relaxed curl; frame 1 is a calibration pose.
    "cmu": {
        "load": _load_bvh, "skip_first": True,
        "rename": {"LeftHandFinger1": "LeftHandIndex1", "RightHandFinger1": "RightHandIndex1"},
        "swing": {b for p in ("{S}UpLeg", "{S}Leg", "{S}Foot", "{S}ToeBase", "{S}Arm", "{S}ForeArm") for b in _sides(p)},
        "hands": {b for p in ("{S}Hand", "{S}FingerBase", "{S}HandFinger1", "{s}Thumb") for b in _sides(p)},
        "curl": {"FingerBase": 8, "HandFinger1": 40}, "roles": CMU_ROLES,
    },
    # Mixamo (exported on the X Bot, without skin, 30 fps): a clean T-pose, real hands and fingers.
    # The arms, hands, fingers and legs differ from MakeHuman's rest as a pose, and are aligned.
    "mixamo": {
        "load": _load_fbx, "skip_first": False, "rename": {},
        "swing": {MIX + b for p in ["{S}UpLeg", "{S}Leg", "{S}Foot", "{S}ToeBase", "{S}Arm", "{S}ForeArm", "{S}Hand"]
                  + ["{S}Hand" + f for f in _FINGERS] for b in _sides(p)},
        "hands": set(), "curl": {}, "roles": MIXAMO_ROLES,
    },
}


def role(profile, name, side=None):
    r = PROFILES[profile]["roles"][name]
    return r.format(S=side, s=side[0]) if side else r


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


def _leg(arm, world, profile):
    """Thigh + shin length: the part of a skeleton that sets how far a step goes."""
    b = arm.data.bones
    head = lambda r: world @ b[role(profile, r, "Left")].head_local
    return (head("leg") - head("upleg")).length + (head("foot") - head("leg")).length


def _curls(rig, profile):
    """Each finger bone's curl as a local rotation: about the knuckle line, toward the palm (which faces
    down in MakeHuman's rest pose). Only for profiles whose clips have no hand data."""
    P = PROFILES[profile]
    rw = rig.matrix_world
    out = {}
    for side in ("Left", "Right"):
        hb = rig.data.bones[role(profile, "hand", side)]
        hand = (rw.to_3x3() @ (hb.tail_local - hb.head_local)).normalized()
        t = (rw @ rig.data.bones[role(profile, "thumb", side)].head_local) - (rw @ hb.head_local)
        knuckles = (t - hand * t.dot(hand)).normalized()
        for part, deg in P["curl"].items():
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


def _reference(rig, src, profile):
    """World rotations of the person's bones, the SWING ones turned to point as the clip's do at rest."""
    P = PROFILES[profile]
    rw, sw = rig.matrix_world, src.matrix_world
    rest = {b.name: (rw @ b.matrix_local).to_quaternion() for b in rig.data.bones}
    ref, delta = {}, {}
    for bone in _ordered(list(rig.data.bones)):
        n = bone.name
        carried = delta[bone.parent.name] if bone.parent else Quaternion()
        q = carried @ rest[n]
        sn = P["rename"].get(n, n)
        if n in P["swing"] and sn in src.data.bones:
            sb = src.data.bones[sn]
            want = sw.to_3x3() @ (sb.tail_local - sb.head_local)
            have = carried @ (rw.to_3x3() @ (bone.tail_local - bone.head_local))
            if want.length > 1e-6 and have.length > 1e-6:
                q = have.rotation_difference(want) @ q
        ref[n] = q
        delta[n] = q @ rest[n].inverted()
    return ref


def retarget(rig, path, name, start_s=0.0, end_s=None, profile="cmu"):
    """Bake the clip at `path` (or a slice of it, in seconds) onto rig as a new action called name.
    Returns (action, frames, check report, ghost)."""
    P = PROFILES[profile]
    src, ft = P["load"](path)
    src.animation_data.action.name = "src." + name    # keep `name` free for the baked action
    bpy.context.scene.render.fps = FPS                # the exporter samples actions at the scene's rate
    bpy.context.scene.render.fps_base = 1
    sw = src.matrix_world
    s_rest = {b.name: (sw @ b.matrix_local).to_quaternion() for b in src.data.bones}
    t_ref = _reference(rig, src, profile)
    curls = _curls(rig, profile)
    scale = _leg(rig, rig.matrix_world, profile) / _leg(src, sw, profile)

    act = src.animation_data.action
    first, last = int(act.frame_range[0]) + (1 if P["skip_first"] else 0), int(act.frame_range[1])
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
    hips = role(profile, "hips")
    hips_rest = rig.data.bones[hips]
    origin = None
    prev = {}
    k = -1
    src_bones = [b for b in src.pose.bones if not b.name.endswith("_End")]
    ghost = {"joints": [b.name for b in src_bones],
             "parents": [src_bones.index(b.parent) if b.parent in src_bones else -1 for b in src_bones],
             "fps": FPS, "frames": []}
    for k, f in enumerate(range(a, b + 1, step)):
        bpy.context.scene.frame_set(f)
        want = {}  # armature-space rotation of each person bone this frame
        for bone in order:
            n = bone.name
            sn = P["rename"].get(n, n)
            if sn in src.pose.bones and n not in P["hands"]:
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
        hw = sw @ src.pose.bones[P["rename"].get(hips, hips)].head
        if origin is None:
            origin = Vector((hw.x, hw.y, 0.0))
        # The ghost: every joint of the recording, scaled and placed like the person, in glTF axes (Y up).
        flat = []
        for sb in src_bones:
            j = ((sw @ sb.head) - origin) * scale
            flat += [round(j.x, 3), round(j.z, 3), round(-j.y, 3)]
        ghost["frames"].append(flat)
        p = (hw - origin) * scale
        pb = rig.pose.bones[hips]
        pb.location = hips_rest.matrix_local.inverted() @ (rw.inverted() @ p)
        pb.keyframe_insert("location", frame=k + 1, group=hips)

    frames = k + 1
    report = check(rig, src, action, a, step, frames, profile)
    src_action = src.animation_data.action
    bpy.data.objects.remove(src, do_unlink=True)
    bpy.data.actions.remove(src_action)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    return action, frames, report, ghost


def check(rig, src, action, first, step, frames, profile="cmu"):
    """How the baked motion compares with the recording, every 10th frame (degrees unless noted):
      limbs      the largest angle between an aligned bone's direction on the person and on the
                 recording (0)
      shrug      the most the person's collarbone rises or falls from its own rest beyond what the
                 recording's does from its rest (0: shoulders move as the actor's did)
      wrist      the largest bend between forearm and hand, beyond the recording's own
      curl       how far the fingers' bend is a curl toward the palm (1) rather than a sideways splay (0)
      lean       the largest torso lean from vertical, person and recording
      tilt       the most the head rolls off level beyond what the recording's does (the user saw a
                 tilted head, 2026-10-25)
      clearance  metres between a fingertip and the thigh's surface at the closest (the user saw
                 fingers pass into the legs, 2026-10-25): below 0 is inside the leg"""
    P = PROFILES[profile]
    R = lambda r, s=None: role(profile, r, s)
    S = lambda n: P["rename"].get(n, n)
    rw, sw = rig.matrix_world, src.matrix_world
    tdir = lambda n: (rw @ rig.pose.bones[n].tail) - (rw @ rig.pose.bones[n].head)
    sdir = lambda n: (sw @ src.pose.bones[n].tail) - (sw @ src.pose.bones[n].head)
    rest = lambda arm, w, n: w.to_3x3() @ (arm.data.bones[n].tail_local - arm.data.bones[n].head_local)
    elev = lambda v: math.degrees(math.asin(max(-1.0, min(1.0, v.z / v.length))))
    ang = lambda a, b: math.degrees(a.angle(b)) if a.length > 1e-9 and b.length > 1e-9 else 0.0
    up = Vector((0, 0, 1))
    def roll(arm, w, bone):   # the head's side-to-side axis (bone local X) against level, degrees
        x = (w @ arm.pose.bones[bone].matrix).to_3x3() @ Vector((1, 0, 0))
        return math.degrees(math.asin(max(-1.0, min(1.0, x.normalized().z))))
    def seg(p, a, b):          # distance from point p to segment ab
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (a + ab * t - p).length
    r = {"limbs": 0.0, "shrug": 0.0, "wrist": 0.0, "curl": 1.0, "lean": [0.0, 0.0], "tilt": 0.0, "clearance": 1.0}
    rig.animation_data.action = action
    swing = [n for n in P["swing"] if S(n) in src.pose.bones]
    for k in range(0, frames, 10):
        bpy.context.scene.frame_set(k + 1)
        t = {n: tdir(n).copy() for n in swing}
        for s in ("Left", "Right"):
            for rr in ("clavicle", "forearm", "hand", "finger"):
                t[R(rr, s)] = tdir(R(rr, s)).copy()
        PT = lambda n, tail=False: rw @ (rig.pose.bones[n].tail if tail else rig.pose.bones[n].head)
        thumbs = {s: PT(R("thumb", s)) - PT(R("hand", s)) for s in ("Left", "Right")}
        t_lean = ang(PT(R("neck")) - PT(R("hips")), up)
        t_roll = roll(rig, rw, R("head"))
        for s in ("Left", "Right"):
            tip = PT(R("fingertip", s), tail=True)
            near = min(seg(tip, PT(R("upleg", x)), PT(R("leg", x))) for x in ("Left", "Right"))
            r["clearance"] = min(r["clearance"], near - THIGH_M)
        bpy.context.scene.frame_set(first + k * step)
        s_lean = ang((sw @ src.pose.bones[S(R("neck"))].head) - (sw @ src.pose.bones[S(R("hips"))].head), up)
        r["lean"] = [max(r["lean"][0], t_lean), max(r["lean"][1], s_lean)]
        r["tilt"] = max(r["tilt"], abs(t_roll) - abs(roll(src, sw, S(R("head")))))
        for n in swing:
            r["limbs"] = max(r["limbs"], ang(t[n], sdir(S(n))))
        for s in ("Left", "Right"):
            c = R("clavicle", s)
            mine = elev(t[c]) - elev(rest(rig, rw, c))
            theirs = elev(sdir(S(c))) - elev(rest(src, sw, S(c)))
            r["shrug"] = max(r["shrug"], abs(mine - theirs))
            bend = ang(t[R("forearm", s)], t[R("hand", s)])
            if not P["hands"]:          # the clip has real wrists: hold ours to theirs
                bend -= ang(sdir(S(R("forearm", s))), sdir(S(R("hand", s))))
            r["wrist"] = max(r["wrist"], bend)
            hand, finger = t[R("hand", s)].normalized(), t[R("finger", s)].normalized()
            if hand.angle(finger) > math.radians(10):
                thumb = thumbs[s]
                knuckles = (thumb - hand * thumb.dot(hand)).normalized()     # across the knuckles
                axis = hand.cross(finger).normalized()                      # what the fingers turned about
                r["curl"] = min(r["curl"], abs(axis.dot(knuckles)))
    r = {k: ([round(x, 1) for x in v] if isinstance(v, list) else round(v, 2 if k in ("curl", "clearance") else 1)) for k, v in r.items()}
    r["warnings"] = [f"{k} {r[k]} (limit {lim})" for k, lim in CHECKS.items()
                     if (r[k] < lim if k in ("curl", "clearance") else r[k] > lim)]
    return r
