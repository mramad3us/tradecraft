# TRADECRAFT: make a person with MPFB (MakeHuman for Blender) and export it as glTF, headless.
#
#   blender -b --python tools/blender/person.py -- --spec spec.json --out person.glb
#   blender -b --python tools/blender/person.py -- --list clothes      (what's installed, by kind)
#
# The spec is a small JSON object; everything has a default:
#   { "name": "courier",
#     "body": { "gender": 1.0, "age": 0.5, "muscle": 0.5, "weight": 0.5, "height": 0.5,
#               "proportions": 0.5, "race": { "african": 0.1, "asian": 0.1, "caucasian": 0.8 } },
#     "skin": "young caucasian male", "eyes": "brown", "eyebrows": "eyebrow001",
#     "hair": "short02", "proxy": "male_generic", "rig": "game_engine",
#     "clothes": ["suit", "shoes01"] }
# Asset values are matched against the installed asset files by name: an exact file name first,
# then the first one containing the words given ("young caucasian male" matches
# young_caucasian_male.mhmat). "body" is MakeHuman's macro sliders (0..1; gender 0 is female,
# 1 male; age 0.5 is 25 years, 1.0 is 90).
#
# What comes out is meant for the game, not for a close-up: the low-poly body proxy instead of the
# full mesh, no subdivision, the game-engine skin material (plain PBR textures that glTF carries),
# and a skeleton (game_engine by default; "mixamo" takes Mixamo animations as they are).
#
# --motions 07_01,17_03@4-12 bakes CMU motion-capture clips (tools/fetch-cmu.sh, cached) onto the
# person as named animations (07_01, 17_03…; @start-end in seconds takes a slice). Motion needs the
# cmu_mb skeleton, which is then used whatever the spec says (tools/blender/retarget.py). Then
# gltf-transform shrinks it (textures 1024 px WebP, meshopt meshes) unless --raw. Next to the .glb, a
# .credits.json lists the spec and every asset's author, licence and source (CC-BY ones are printed).
import argparse, glob, json, os, re, struct, subprocess, sys, importlib
import bpy

mpfb = "bl_ext.blender_org.mpfb.services."
HumanService = importlib.import_module(mpfb + "humanservice").HumanService
LocationService = importlib.import_module(mpfb + "locationservice").LocationService
ObjectService = importlib.import_module(mpfb + "objectservice").ObjectService

KINDS = {"skin": ("skins", ".mhmat"), "eyes": ("eyes", ".mhclo"), "eyebrows": ("eyebrows", ".mhclo"),
         "eyelashes": ("eyelashes", ".mhclo"), "hair": ("hair", ".mhclo"), "teeth": ("teeth", ".mhclo"),
         "tongue": ("tongue", ".mhclo"), "proxy": ("proxymeshes", ".proxy"), "clothes": ("clothes", ".mhclo")}

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser(prog="person.py")
ap.add_argument("--spec", help="a JSON file, or a JSON object inline")
ap.add_argument("--out", help="the .glb to write")
ap.add_argument("--list", choices=sorted(KINDS), help="list the installed assets of one kind")
ap.add_argument("--raw", action="store_true", help="skip the optimisation pass (gltf-transform)")
ap.add_argument("--motions", default="", help="CMU clips to bake, e.g. 07_01,17_03@4-12 (seconds)")
args = ap.parse_args(argv)


def installed(kind):
    sub, ext = KINDS[kind]
    root = LocationService.get_user_data(sub)
    return sorted(glob.glob(os.path.join(root, "**", "*" + ext), recursive=True))


def find(kind, want):
    """The installed asset of this kind that `want` names: exact stem, else every word contained."""
    if not want:
        return None
    files = installed(kind)
    stem = lambda f: os.path.splitext(os.path.basename(f))[0].lower()
    w = want.lower().replace(" ", "_")
    for f in files:
        if stem(f) == w:
            return f
    words = re.split(r"[\s_]+", want.lower())
    for f in files:
        if all(x in stem(f) for x in words):
            return f
    raise SystemExit(f"no {kind} matching '{want}' (try: --list {kind})")


if args.list:
    for f in installed(args.list):
        print(os.path.relpath(f, LocationService.get_user_data(KINDS[args.list][0])))
    sys.exit(0)

spec = {}
if args.spec:
    spec = json.loads(open(args.spec).read() if os.path.exists(args.spec) else args.spec)
body = {"gender": 0.5, "age": 0.5, "muscle": 0.5, "weight": 0.5, "proportions": 0.5, "height": 0.5,
        "cupsize": 0.5, "firmness": 0.5, "race": {"african": 0.33, "asian": 0.33, "caucasian": 0.33}}
body.update({k: v for k, v in spec.get("body", {}).items() if k != "race"})
body["race"].update(spec.get("body", {}).get("race", {}))
male = body["gender"] >= 0.5

info = {
    "name": spec.get("name", "person"),
    "phenotype": body,
    "rig": "cmu_mb" if args.motions else spec.get("rig", "game_engine"),
    "eyes": find("eyes", spec.get("eyes", "low-poly")),
    "eyebrows": find("eyebrows", spec.get("eyebrows", "eyebrow001")),
    "eyelashes": find("eyelashes", spec.get("eyelashes", "eyelashes01")),
    "hair": find("hair", spec.get("hair")),
    "proxy": find("proxy", spec.get("proxy", "male_generic" if male else "female_generic")),
    "clothes": [find("clothes", c) for c in spec.get("clothes", [])],
    "skin_mhmat": find("skin", spec.get("skin", "young caucasian male" if male else "young caucasian female")),
    "skin_material_type": "GAMEENGINE",
    "eyes_material_type": "MAKESKIN",
    "clothes_material_type": "MAKESKIN",
    "alternative_materials": {},
    "targets": [],
}
settings = HumanService.get_default_deserialization_settings()
settings["subdiv_levels"] = 0

bpy.ops.wm.read_factory_settings(use_empty=True)
basemesh = HumanService.deserialize_from_dict(info, settings)

# Ship the proxy, not the full basemesh: hide the basemesh from the export.
proxy = ObjectService.find_object_of_type_amongst_nearest_relatives(basemesh, "Proxymeshes")
if proxy is not None:
    basemesh.hide_render = True
    basemesh.hide_set(True)

# Motion: each CMU clip baked as its own action on the skeleton.
CMU = os.path.join(os.path.expanduser("~/Library/Caches/tradecraft"), "cmu", "bvh")
motions = []
if args.motions:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import retarget
    rig = ObjectService.find_object_of_type_amongst_nearest_relatives(basemesh, "Skeleton")
    for m in args.motions.split(","):
        mid, _, span = m.partition("@")
        bvh = os.path.join(CMU, mid + ".bvh")
        if not os.path.exists(bvh):
            raise SystemExit(f"no clip {mid}: run tools/fetch-cmu.sh {mid}")
        a, _, b = span.partition("-")
        name = mid if not span else f"{mid}@{span}"
        action, frames = retarget.retarget(rig, bvh, name, float(a or 0), float(b) if b else None)
        motions.append({"clip": name, "frames": frames, "seconds": round(frames / retarget.FPS, 2)})
        print(f"motion {name}: {frames} frames ({frames / retarget.FPS:.1f} s)")

tris = 0
for o in bpy.context.scene.objects:
    if o.type == "MESH" and o.visible_get():
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
print(f"person '{info['name']}': {tris} triangles, rig {info['rig']}, "
      f"{len(info['clothes'])} clothes, proxy {'yes' if proxy else 'no'}")

def credits():
    """Author, licence and source of every asset used, from the packs' metadata (data/packs/*.json)."""
    meta = {}
    for f in glob.glob(os.path.join(LocationService.get_user_data("packs"), "*.json")):
        for name, m in json.load(open(f)).items():
            meta.setdefault(name, dict(m, pack=os.path.basename(f)[:-5]))
    used = [info[k] for k in ("eyes", "eyebrows", "eyelashes", "hair", "proxy", "skin_mhmat") if info.get(k)]
    out = []
    for m in motions:
        out.append({"asset": "cmu " + m["clip"], "author": "CMU Graphics Lab Motion Capture Database",
                    "license": "CMU (free for research and commercial use)", "source": "http://mocap.cs.cmu.edu",
                    "pack": "cgspeed BVH conversion (github.com/Shriinivas/cmubvh)"})
    for path in used + info["clothes"]:
        name = os.path.splitext(os.path.basename(path))[0]
        m = meta.get(name, {})
        out.append({"asset": name, "author": m.get("author", "?"), "license": m.get("license", "?"),
                    "source": m.get("source", ""), "pack": m.get("pack", "?")})
    return out


def fix_materials(path):
    """What MPFB's materials need to look right in the game, set in the GLB's JSON chunk:
    - opacity: skin and eyes OPAQUE; hair, brows, lashes and clothes cut out (MASK). MPFB wires every
      texture's alpha, so the exporter marks all of them BLEND, and a blended body hides nothing behind
      it: the inside of the mouth and the backs of the eyes showed through the face;
    - finish: MAKESKIN gives clothes, hair and brows a clear coat (car-paint varnish) and the suit a
      glossy roughness map, so cloth shone like vinyl under an environment light. Only the eyes keep
      the coat; cloth is matte (0.85), shoes have a little sheen (0.55), hair 0.6, skin 0.55."""
    stem = lambda p: os.path.splitext(os.path.basename(p))[0]
    me = lambda p: info["name"] + "." + stem(p)
    opaque = {info["name"] + ".body"} | {me(info["eyes"])}
    eyes = me(info["eyes"])
    hairlike = {me(info[k]) for k in ("hair", "eyebrows", "eyelashes") if info.get(k)}
    clothes = {me(c) for c in info["clothes"]}
    with open(path, "rb") as f:
        data = f.read()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    jlen, jtype = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + jlen])
    rest = data[20 + jlen:]
    for m in gltf.get("materials", []):
        n = m.get("name")
        if n in opaque:
            m["alphaMode"] = "OPAQUE"
            m.pop("alphaCutoff", None)
        else:
            m["alphaMode"] = "MASK"
            m["alphaCutoff"] = 0.5
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"] = 0.0
        if n != eyes:
            m.get("extensions", {}).pop("KHR_materials_clearcoat", None)
            if not m.get("extensions"):
                m.pop("extensions", None)
        if n in clothes:
            pbr.pop("metallicRoughnessTexture", None)
            pbr["roughnessFactor"] = 0.55 if re.search(r"shoe|boot|sneaker|oxford|loafer", n) else 0.85
        elif n in hairlike:
            pbr["roughnessFactor"] = 0.6
        elif n == info["name"] + ".body":
            pbr["roughnessFactor"] = 0.55
    if not any("KHR_materials_clearcoat" in m.get("extensions", {}) for m in gltf.get("materials", [])):
        for k in ("extensionsUsed", "extensionsRequired"):
            if k in gltf:
                gltf[k] = [e for e in gltf[k] if e != "KHR_materials_clearcoat"]
                if not gltf[k]:
                    gltf.pop(k)
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", magic, version, 20 + len(js) + len(rest)))
        f.write(struct.pack("<II", len(js), jtype) + js + rest)


if args.out:
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format="GLB", use_visible=True,
                              export_skins=True, export_animations=bool(motions), export_animation_mode="ACTIONS",
                              export_apply=True,
                              export_image_format="JPEG", export_jpeg_quality=85)
    fix_materials(os.path.abspath(args.out))
    if not args.raw:
        # Game-sized: textures to 1024 px WebP, meshes meshopt-compressed (the game's GLTFLoader has the
        # decoder). Through the repo's pinned gltf-transform; 13 MB becomes about 1 MB.
        repo = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        raw = os.path.abspath(args.out)
        subprocess.run([os.path.join(repo, "node_modules", ".bin", "gltf-transform"), "optimize", raw, raw,
                        "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"],
                       check=True, stdout=subprocess.DEVNULL)
    cr = credits()
    with open(os.path.splitext(args.out)[0] + ".credits.json", "w") as f:
        json.dump({"spec": spec, "motions": motions, "assets": cr}, f, indent=1)
    lic = sorted({c["license"] for c in cr})
    print(f"wrote {args.out} ({os.path.getsize(args.out) // 1024} KB); licences: {', '.join(lic)}")
    for c in cr:
        if c["license"] not in ("CC0",) and not c["asset"].startswith("cmu "):
            print(f"  credit: {c['asset']} by {c['author']} ({c['license']}) {c['source']}")
