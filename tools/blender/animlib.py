# TRADECRAFT: an animation library, fitted once to our people's skeleton.
#
#   blender -b --python tools/blender/animlib.py -- --profile mixamo --dir <folder of clips> --out assets/anim/mixamo.glb
#                [--only walking,sprint] [--spec person.json]
#
# Every clip in the folder (Mixamo: <key>.fbx, exported on the X Bot without skin at 30 fps) is put
# on one reference person's skeleton (MPFB's `mixamo` rig, the default body unless --spec) by
# tools/blender/retarget.py, and checked against its recording. Out come:
#   <out>              the skeleton, in its rest pose, with every clip as a named animation. Any person
#                      made with the same rig plays them: samples/lib/anim.js re-bases each clip on the
#                      person's own rest pose and scales the hips' travel to their legs, so one library
#                      serves every body;
#   <out-stem>.checks.json   each clip's pose check (limbs, shrug, wrist, curl, lean, tilt, clearance);
#   <out-stem>.motion.json   each clip's recording skeleton (the ghost), for review.
# A clip that fails a check is printed with WARN, and kept: the gallery shows it, and the user decides.
import argparse, glob, json, os, sys, importlib
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser(prog="animlib.py")
ap.add_argument("--profile", default="mixamo")
ap.add_argument("--dir", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--only", default="")
ap.add_argument("--spec", default="")
args = ap.parse_args(argv)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import retarget

mp = "bl_ext.blender_org.mpfb.services."
HumanService = importlib.import_module(mp + "humanservice").HumanService
ObjectService = importlib.import_module(mp + "objectservice").ObjectService

RIG = {"mixamo": "mixamo", "cmu": "cmu_mb"}[args.profile]
body = {"gender": 1.0, "age": 0.5, "muscle": 0.5, "weight": 0.5, "proportions": 0.5, "height": 0.5,
        "cupsize": 0.5, "firmness": 0.5, "race": {"african": 0.33, "asian": 0.33, "caucasian": 0.33}}
if args.spec:
    spec = json.load(open(args.spec))
    body.update({k: v for k, v in spec.get("body", {}).items() if k != "race"})
    body["race"].update(spec.get("body", {}).get("race", {}))
info = {"name": "library", "phenotype": body, "rig": RIG, "proxy": "", "clothes": [], "skin_material_type": "GAMEENGINE",
        "skin_mhmat": "", "alternative_materials": {}, "targets": []}
settings = HumanService.get_default_deserialization_settings()
settings["subdiv_levels"] = 0
bpy.ops.wm.read_factory_settings(use_empty=True)
basemesh = HumanService.deserialize_from_dict(info, settings)
rig = ObjectService.find_object_of_type_amongst_nearest_relatives(basemesh, "Skeleton")

ext = {"mixamo": ".fbx", "cmu": ".bvh"}[args.profile]
only = set(filter(None, args.only.split(",")))
clips = sorted(f for f in glob.glob(os.path.join(os.path.expanduser(args.dir), "*" + ext))
               if not only or os.path.splitext(os.path.basename(f))[0] in only)
if not clips:
    raise SystemExit(f"no {ext} clips in {args.dir}")

checks, ghosts, warned = {}, {}, 0
for path in clips:
    key = os.path.splitext(os.path.basename(path))[0]
    action, frames, check, ghost = retarget.retarget(rig, path, key, profile=args.profile)
    checks[key] = dict(check, frames=frames, seconds=round(frames / retarget.FPS, 2))
    ghosts[key] = ghost
    flag = "  WARN " + "; ".join(check["warnings"]) if check["warnings"] else ""
    warned += bool(check["warnings"])
    print(f"clip {key:22} {frames:4d} f  limbs {check['limbs']}°  shrug {check['shrug']}°  wrist {check['wrist']}°  "
          f"curl {check['curl']}  tilt {check['tilt']}°  clearance {check['clearance']} m{flag}")

# The library file: the skeleton alone, in its rest pose, carrying every clip.
bpy.data.objects.remove(basemesh, do_unlink=True)
for o in list(bpy.context.scene.objects):
    if o is not rig:
        bpy.data.objects.remove(o, do_unlink=True)
rig.name = "library"
out = os.path.abspath(args.out)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
                          export_skins=True, export_force_sampling=True, export_optimize_animation_size=False)
stem = os.path.splitext(out)[0]
json.dump({"profile": args.profile, "rig": RIG, "clips": checks}, open(stem + ".checks.json", "w"), indent=1)
json.dump(ghosts, open(stem + ".motion.json", "w"), separators=(",", ":"))
print(f"library: {len(clips)} clips, {warned} with warnings; wrote {args.out} ({os.path.getsize(out) // 1024} KB)")
