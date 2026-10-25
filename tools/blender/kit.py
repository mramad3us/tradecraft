# TRADECRAFT: the building kit. The detailed pieces a building is dressed with, made in Blender.
#
#   blender -b --python tools/blender/kit.py -- --out assets/kit/kit.glb
#
# Buildings themselves are assembled by the game (samples/lib/building.js): walls, floors and the
# openings in them are simple shapes better made at runtime, where a city is data and cutaways are
# free. What fills an opening (a window unit with its frame, glass and sill, a door, a shopfront) or
# stands in a room (a flight of stairs) is made here, where bevels and detail cost nothing.
#
# Every piece is one top-level node in kit.glb, named as below, with its glTF extras saying how the
# game should use it:
#   opening  [width, height] of the hole it fills, in metres
#   sill     height of the hole's bottom above the floor
#   kind     window | door | shop | stairs | balcony
# A piece's origin is the bottom middle of its opening, in the wall's mid-plane; its front faces out
# of the wall (glTF +Z; Blender -Y). Sizes are real: metres, a 0.25 m wall, a 3 m storey.
# Materials are named (frame, frame_dark, glass, stone, door_paint, metal, wood) so the game can
# recolour a street.
import argparse, math, os, sys
import bpy, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser(prog="kit.py")
ap.add_argument("--out", default="assets/kit/kit.glb")
args = ap.parse_args(argv)

WALL = 0.25          # the wall the pieces are made for
BEVEL = 0.006        # a small bevel on every edge: catches the light, kills the CG look

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, rough=0.6, metal=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        m.surface_render_method = "BLENDED"
    return m


MAT = {
    "frame": material("frame", (0.86, 0.86, 0.83), 0.45),
    "frame_dark": material("frame_dark", (0.08, 0.09, 0.1), 0.4, 0.5),
    "glass": material("glass", (0.06, 0.08, 0.1), 0.04, 0.0, 0.32),
    "stone": material("stone", (0.68, 0.66, 0.62), 0.85),
    "door_paint": material("door_paint", (0.09, 0.16, 0.13), 0.45),
    "metal": material("metal", (0.72, 0.6, 0.38), 0.3, 1.0),
    "wood": material("wood", (0.42, 0.3, 0.2), 0.7),
}


def box(parent, name, size, at, mat, bevel=True):
    """An axis-aligned box: size (x, y, z) in metres, `at` its centre, relative to the piece's origin."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(at)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(MAT[mat])
    obj.parent = parent
    if bevel and min(size) > 2 * BEVEL:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = BEVEL
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return obj


def piece(name, kind, opening, sill):
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    root["kind"] = kind
    root["opening"] = list(opening)
    root["sill"] = sill
    return root


def frame(root, w, h, z0, bar, depth, mat, y=0.0):
    """A rectangular frame filling an opening w × h whose bottom is at z0."""
    box(root, root.name + ".frame_l", (bar, depth, h), (-w / 2 + bar / 2, y, z0 + h / 2), mat)
    box(root, root.name + ".frame_r", (bar, depth, h), (w / 2 - bar / 2, y, z0 + h / 2), mat)
    box(root, root.name + ".frame_t", (w - 2 * bar, depth, bar), (0, y, z0 + h - bar / 2), mat)
    box(root, root.name + ".frame_b", (w - 2 * bar, depth, bar), (0, y, z0 + bar / 2), mat)


def glass(root, w, h, z0, y=0.0):
    box(root, root.name + ".glass", (w, 0.012, h), (0, y, z0 + h / 2), "glass", bevel=False)


# A casement window: 1.2 × 1.5 m, its bottom 0.9 m up, two leaves, a stone sill outside.
def window_casement():
    w, h, s = 1.2, 1.5, 0.9
    r = piece("window_casement", "window", (w, h), s)
    frame(r, w, h, 0, 0.07, 0.11, "frame")
    box(r, r.name + ".mullion", (0.06, 0.1, h - 0.14), (0, 0, h / 2), "frame")
    box(r, r.name + ".transom", (w - 0.14, 0.09, 0.05), (0, 0, h * 0.72), "frame")
    glass(r, w - 0.14, h - 0.14, 0.07)
    box(r, r.name + ".sill", (w + 0.16, 0.2, 0.05), (0, -WALL / 2 - 0.02, -0.025), "stone")
    return r


# A tall window, floor to near ceiling (a French window): 1.1 × 2.3 m, from the floor.
def window_tall():
    w, h, s = 1.1, 2.3, 0.0
    r = piece("window_tall", "window", (w, h), s)
    frame(r, w, h, 0, 0.07, 0.11, "frame")
    box(r, r.name + ".mullion", (0.06, 0.1, h - 0.14), (0, 0, h / 2), "frame")
    box(r, r.name + ".kick", (w - 0.14, 0.08, 0.35), (0, 0, 0.07 + 0.175), "frame")
    glass(r, w - 0.14, h - 0.56, 0.42)
    return r


# A shopfront: 3.0 × 2.7 m, from 0.4 m up (a dark kickplate below), a transom light above 2.2 m.
def shopfront():
    w, h, s = 3.0, 2.7, 0.0
    r = piece("shopfront", "shop", (w, h), s)
    frame(r, w, h, 0, 0.06, 0.1, "frame_dark")
    box(r, r.name + ".kick", (w - 0.12, 0.1, 0.4), (0, 0, 0.06 + 0.2), "frame_dark")
    box(r, r.name + ".transom", (w - 0.12, 0.09, 0.05), (0, 0, 2.2), "frame_dark")
    box(r, r.name + ".mullion", (0.05, 0.09, 2.2 - 0.46), (w * 0.18, 0, 0.46 + (2.2 - 0.46) / 2), "frame_dark")
    glass(r, w - 0.12, 2.2 - 0.46 - 0.025, 0.46)
    glass(r, w - 0.12, h - 2.225 - 0.06, 2.225)
    return r


# A flat door: 0.9 × 2.1 m, a panelled leaf in a frame, a brass handle.
def door_flat():
    w, h, s = 0.9, 2.1, 0.0
    r = piece("door_flat", "door", (w, h), s)
    frame(r, w, h + 0.0, 0, 0.06, 0.13, "frame")
    leaf = box(r, r.name + ".leaf", (w - 0.12, 0.045, h - 0.06), (0, -0.01, (h - 0.06) / 2), "door_paint")
    for zc in (0.55, 1.45):
        box(r, r.name + f".panel{zc}", (w - 0.36, 0.015, 0.7), (0, -0.04, zc), "door_paint")
    box(r, r.name + ".handle", (0.12, 0.05, 0.025), (w / 2 - 0.16, -0.06, 1.0), "metal")
    return r


# A building's entrance: 1.4 × 2.6 m, two leaves with glass in their upper half, a fanlight.
def door_entrance():
    w, h, s = 1.4, 2.6, 0.0
    r = piece("door_entrance", "door", (w, h), s)
    frame(r, w, h, 0, 0.08, 0.14, "frame_dark")
    box(r, r.name + ".transom", (w - 0.16, 0.12, 0.07), (0, 0, 2.15), "frame_dark")
    glass(r, w - 0.16, h - 2.19 - 0.08, 2.19)
    for side in (-1, 1):
        x = side * (w - 0.16) / 4
        lw = (w - 0.16) / 2 - 0.01
        box(r, r.name + f".leaf_bottom{side}", (lw, 0.05, 1.0), (x, -0.01, 0.5), "door_paint")
        frame_x = [x - lw / 2 + 0.04, x + lw / 2 - 0.04]
        for fx in frame_x:
            box(r, r.name + f".leaf_stile{side}{fx:.2f}", (0.08, 0.05, 1.1), (fx, -0.01, 1.0 + 0.55), "door_paint")
        box(r, r.name + f".leaf_top{side}", (lw, 0.05, 0.08), (x, -0.01, 2.07), "door_paint")
        glass(r, lw - 0.16, 1.02, 1.03, y=-0.01)
        box(r, r.name + f".handle{side}", (0.025, 0.05, 0.3), (side * 0.06, -0.06, 1.05), "metal")
    return r


# A straight flight of stairs: 1.0 m wide, 3.0 m of rise in 17 steps (17.6 cm), 28 cm treads,
# climbing towards +Y (into the room); solid underneath.
def stairs():
    width, rise, n, tread = 1.0, 3.0, 17, 0.28
    r = piece("stairs_straight", "stairs", (width, rise), 0.0)
    step = rise / n
    for i in range(n):
        box(r, r.name + f".step{i:02d}", (width, tread, step * (i + 1)), (0, tread * i + tread / 2, step * (i + 1) / 2), "wood")
    r["run"] = n * tread
    return r


# A balcony for a tall window: a 1.6 × 0.8 m slab, a railing 1.0 m high with balusters.
def balcony():
    w, d = 1.6, 0.8
    r = piece("balcony", "balcony", (w, 0.0), 0.0)
    y0 = -WALL / 2 - d / 2
    box(r, r.name + ".slab", (w, d, 0.14), (0, y0, -0.07), "stone")
    box(r, r.name + ".rail", (w, 0.05, 0.04), (0, y0 - d / 2 + 0.03, 1.0), "frame_dark")
    for side in (-1, 1):
        box(r, r.name + f".rail_side{side}", (0.04, d, 0.04), (side * (w / 2 - 0.02), y0, 1.0), "frame_dark")
    count = 14
    for i in range(count + 1):
        x = -w / 2 + 0.03 + i * (w - 0.06) / count
        box(r, r.name + f".bar{i:02d}", (0.018, 0.018, 1.0), (x, y0 - d / 2 + 0.03, 0.5), "frame_dark", bevel=False)
    return r


pieces = [window_casement(), window_tall(), shopfront(), door_flat(), door_entrance(), stairs(), balcony()]
# Lay them out side by side in the file, so a look at it in Blender shows the whole kit; the game
# reads each by name and places it itself.
x = 0.0
for p in pieces:
    p.location.x = x + p["opening"][0] / 2
    x += p["opening"][0] + 0.8

out = os.path.abspath(args.out)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_extras=True, export_apply=True,
                          export_yup=True)
tris = 0
for o in scene.objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
print(f"kit: {len(pieces)} pieces ({', '.join(p.name for p in pieces)}), {tris} triangles before bevels; "
      f"wrote {args.out} ({os.path.getsize(out) // 1024} KB)")
