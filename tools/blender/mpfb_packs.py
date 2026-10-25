# TRADECRAFT: install MakeHuman asset packs into MPFB, headless.
#
#   blender -b --python tools/blender/mpfb_packs.py -- <pack.zip>...
#
# Each zip goes through MPFB's own installer (mpfb.load_pack: it checks the zip, then unpacks
# it into MPFB's data folder). A pack already installed (its <name>.json under data/packs) is
# skipped, so this is safe to run again. Called by tools/setup.sh.
import os, re, sys
import importlib
import bpy

# Blender 4.2+ imports extensions as bl_ext.<repository>.<id>.
AssetService = importlib.import_module("bl_ext.blender_org.mpfb.services.assetservice").AssetService

zips = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
installed = set(AssetService.get_pack_names())
done, skipped = [], []
for z in zips:
    name = re.sub(r"_(cc0|ccby|cc-by)$", "", os.path.basename(z)[:-4])
    if name in installed:
        skipped.append(name)
        continue
    bpy.ops.mpfb.load_pack(filepath=os.path.abspath(z))
    done.append(name)
AssetService.invalidate_pack_metadata_cache()
now = AssetService.get_pack_names()
print(f"MPFB packs: {len(done)} installed, {len(skipped)} already there; {len(now)} in all")
missing = [re.sub(r"_(cc0|ccby|cc-by)$", "", os.path.basename(z)[:-4]) for z in zips]
missing = [m for m in missing if m not in now]
if missing:
    print("not registered after install (check the names):", ", ".join(missing))
