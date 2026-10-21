"""Build the vertical slice's placeholder 3D models.

Run headless from the repository root:
    blender --background --factory-startup --python blender/scripts/build_placeholder_models.py -- public/assets/models [preview_dir]

Each model is one mesh with one material sampling a shared colour palette
(base colour + emission), in the dark style (D-78, D-84). Ships face Blender -Y,
which the glTF exporter turns into +Z. The station's ring is a child object
named "Ring" so the game can spin it.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- palette ---

CELLS = 4
CELL_PX = 16

# name: (base colour sRGB, emission sRGB or None)
PALETTE = {
    "steel": ((0.36, 0.40, 0.48), None),
    "steel_dark": ((0.13, 0.15, 0.20), None),
    "gunmetal": ((0.22, 0.24, 0.29), None),
    "panel": ((0.10, 0.16, 0.29), None),
    "signal": ((0.89, 0.28, 0.25), (0.89, 0.28, 0.25)),
    "holo": ((0.37, 0.66, 0.85), (0.37, 0.66, 0.85)),
    "glass": ((0.15, 0.25, 0.32), (0.08, 0.16, 0.22)),
    "hazard": ((0.72, 0.58, 0.22), None),
    "rust": ((0.42, 0.22, 0.15), None),
    "rust_dark": ((0.20, 0.11, 0.09), None),
    "engine_player": ((0.55, 0.85, 1.00), (0.55, 0.85, 1.00)),
    "engine_enemy": ((1.00, 0.42, 0.20), (1.00, 0.42, 0.20)),
    "light_warm": ((1.00, 0.85, 0.55), (1.00, 0.85, 0.55)),
    "black": ((0.04, 0.04, 0.05), None),
    "ore": ((0.30, 0.27, 0.24), None),
    "spare": ((0.5, 0.5, 0.5), None),
}
NAMES = list(PALETTE)


def cell_uv(name):
    i = NAMES.index(name)
    return ((i % CELLS + 0.5) / CELLS, (i // CELLS + 0.5) / CELLS)


def make_palette_images():
    size = CELLS * CELL_PX
    base = bpy.data.images.new("palette_base", size, size, alpha=False)
    emit = bpy.data.images.new("palette_emit", size, size, alpha=False)
    bpx = [0.0] * (size * size * 4)
    epx = [0.0] * (size * size * 4)
    for i, name in enumerate(NAMES):
        col, glow = PALETTE[name]
        glow = glow or (0.0, 0.0, 0.0)
        cx, cy = (i % CELLS) * CELL_PX, (i // CELLS) * CELL_PX
        for y in range(cy, cy + CELL_PX):
            for x in range(cx, cx + CELL_PX):
                o = (y * size + x) * 4
                bpx[o:o + 4] = (*col, 1.0)
                epx[o:o + 4] = (*glow, 1.0)
    base.pixels = bpx
    emit.pixels = epx
    for img in (base, emit):
        img.file_format = "PNG"
        img.pack()
    return base, emit


def make_material(base_img, emit_img):
    mat = bpy.data.materials.new("palette")
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Metallic"].default_value = 0.35
    bsdf.inputs["Roughness"].default_value = 0.55
    for img, socket in ((base_img, "Base Color"), (emit_img, "Emission Color")):
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Closest"
        links.new(tex.outputs["Color"], bsdf.inputs[socket])
    bsdf.inputs["Emission Strength"].default_value = 2.0
    return mat


# ------------------------------------------------------------------ parts ---


def _xform(loc, rot, scale):
    r = (
        Matrix.Rotation(math.radians(rot[2]), 4, "Z")
        @ Matrix.Rotation(math.radians(rot[1]), 4, "Y")
        @ Matrix.Rotation(math.radians(rot[0]), 4, "X")
    )
    return Matrix.Translation(loc) @ r @ Matrix.Diagonal((*scale, 1.0))


class Builder:
    """Collects parts as objects, then joins them into one mesh."""

    def __init__(self, name, material):
        self.name = name
        self.material = material
        self.parts = []

    def _finish(self, bm, colour, bevel=0.0):
        if bevel:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", clamp_overlap=True)
        uv = bm.loops.layers.uv.verify()
        u, v = cell_uv(colour)
        for face in bm.faces:
            for loop in face.loops:
                loop[uv].uv = (u, v)
        me = bpy.data.meshes.new(f"{self.name}_part")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(self.material)
        ob = bpy.data.objects.new(f"{self.name}_part", me)
        bpy.context.scene.collection.objects.link(ob)
        self.parts.append(ob)

    def box(self, size, loc, colour, rot=(0, 0, 0), bevel=0.0):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=_xform(loc, rot, size), verts=bm.verts)
        self._finish(bm, colour, bevel)

    def cone(self, r1, r2, depth, loc, colour, rot=(0, 0, 0), scale=(1, 1, 1), segments=12, bevel=0.0):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r1, radius2=r2, depth=depth)
        bmesh.ops.transform(bm, matrix=_xform(loc, rot, scale), verts=bm.verts)
        self._finish(bm, colour, bevel)

    def sphere(self, r, loc, colour, scale=(1, 1, 1), segs=(16, 8)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=r)
        bmesh.ops.transform(bm, matrix=_xform(loc, (0, 0, 0), scale), verts=bm.verts)
        self._finish(bm, colour)

    def torus(self, major, minor, colour, segs=(48, 10)):
        bm = bmesh.new()
        rings = []
        for i in range(segs[0]):
            a = 2 * math.pi * i / segs[0]
            ring = []
            for j in range(segs[1]):
                b = 2 * math.pi * j / segs[1]
                r = major + minor * math.cos(b)
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
            rings.append(ring)
        for i in range(segs[0]):
            a, b = rings[i], rings[(i + 1) % segs[0]]
            for j in range(segs[1]):
                k = (j + 1) % segs[1]
                bm.faces.new((a[j], b[j], b[k], a[k]))
        self._finish(bm, colour)

    def join(self):
        target = self.parts[0]
        with bpy.context.temp_override(
            active_object=target, selected_editable_objects=self.parts, selected_objects=self.parts
        ):
            bpy.ops.object.join()
        target.name = self.name
        target.data.name = self.name
        return target


# Cone axis is +Z; +90 about X points its narrow end (radius2) at -Y (forward).
FORWARD = (90, 0, 0)
BACKWARD = (-90, 0, 0)

# ----------------------------------------------------------------- models ---


def build_barge(mat):
    """Industrial mining barge: boxy hull, ore holds, mining arms up front."""
    b = Builder("barge", mat)
    b.box((2.2, 4.4, 1.2), (0, 0.2, 0), "steel", bevel=0.06)
    b.box((2.4, 1.0, 1.4), (0, 1.9, 0), "gunmetal", bevel=0.04)
    for x in (1.35, -1.35):
        b.box((0.7, 3.0, 0.9), (x, 0.4, -0.1), "steel_dark", bevel=0.04)
        b.box((0.72, 0.15, 0.92), (x, -0.6, -0.1), "hazard")
        b.cone(0.12, 0.06, 1.6, (x * 0.6, -2.6, -0.2), "gunmetal", rot=FORWARD, segments=6)
        b.box((0.3, 0.3, 0.3), (x * 0.6, -3.45, -0.2), "signal")
    b.box((1.0, 0.8, 0.5), (0, -1.6, 0.75), "gunmetal", bevel=0.04)
    b.box((0.8, 0.12, 0.3), (0, -2.0, 0.8), "glass")
    for x in (0.65, -0.65):
        b.cone(0.32, 0.28, 0.6, (x, 2.65, 0), "steel_dark", rot=FORWARD, segments=10)
        b.cone(0.28, 0.0, 0.25, (x, 3.05, 0), "engine_player", rot=BACKWARD, segments=10)
    b.box((0.15, 0.15, 0.15), (1.1, 1.9, 0.75), "holo")
    return b.join()


def build_frigate(mat):
    """Frigate: sleek faceted wedge, swept wings, twin engines, signal stripe."""
    b = Builder("frigate", mat)
    b.cone(0.75, 0.1, 4.2, (0, -0.3, 0), "steel", rot=FORWARD, scale=(1, 1, 0.42), segments=6, bevel=0.03)
    b.cone(0.28, 0.05, 3.0, (0, -0.2, 0.22), "gunmetal", rot=FORWARD, scale=(1, 1, 0.6), segments=6)
    b.sphere(0.24, (0, -1.0, 0.3), "glass", scale=(0.7, 2.0, 0.5), segs=(16, 8))
    for side in (1, -1):
        b.box((1.6, 1.0, 0.08), (side * 1.2, 0.55, -0.05), "steel_dark", rot=(0, side * -6, side * -28), bevel=0.02)
        b.box((1.5, 0.1, 0.1), (side * 1.13, 0.1, -0.03), "signal", rot=(0, side * -6, side * -28))
        b.cone(0.24, 0.2, 1.5, (side * 0.6, 1.0, -0.05), "gunmetal", rot=FORWARD, segments=10)
        b.cone(0.2, 0.0, 0.3, (side * 0.6, 1.85, -0.05), "engine_player", rot=BACKWARD, segments=10)
        b.box((0.06, 0.6, 0.5), (side * 0.5, 1.3, 0.35), "steel_dark", rot=(0, side * 15, 0))
    return b.join()


def build_pirate(mat):
    """Pirate frigate: rusty, asymmetric, forward prongs, hot engines."""
    b = Builder("pirate", mat)
    b.sphere(0.7, (0, 0.2, 0), "rust_dark", scale=(1.0, 1.5, 0.45), segs=(8, 6))
    b.box((0.18, 2.3, 0.2), (0.45, -0.9, 0), "rust")
    b.box((0.18, 1.8, 0.2), (-0.5, -0.7, 0.05), "gunmetal")
    b.cone(0.12, 0.0, 0.4, (0.45, -2.2, 0), "signal", rot=FORWARD, segments=6)
    b.cone(0.12, 0.0, 0.4, (-0.5, -1.75, 0.05), "signal", rot=FORWARD, segments=6)
    b.box((2.0, 0.5, 0.06), (0.15, 0.5, 0), "rust", rot=(0, 0, 8))
    b.box((0.5, 0.7, 0.4), (-0.3, 0.6, 0.35), "black", rot=(0, 0, -12))
    b.cone(0.3, 0.3, 0.6, (0, 1.25, 0), "steel_dark", rot=FORWARD, segments=8)
    b.cone(0.27, 0.0, 0.3, (0, 1.65, 0), "engine_enemy", rot=BACKWARD, segments=8)
    return b.join()


def build_station(mat):
    """Station: hub with solar arrays and docking arms; a separate spinning ring."""
    hub = Builder("station", mat)
    hub.cone(2.0, 2.0, 6.0, (0, 0, 0), "steel", segments=16, bevel=0.05)
    hub.cone(2.0, 0.8, 1.5, (0, 0, 3.75), "steel_dark", segments=16)
    hub.cone(0.8, 2.0, 1.5, (0, 0, -3.75), "steel_dark", segments=16)
    for z in (1.5, -1.5):
        hub.cone(2.05, 2.05, 0.3, (0, 0, z), "holo", segments=16)
    hub.box((0.8, 0.8, 10.0), (0, 0, 0), "gunmetal")
    for z in (5.0, -5.0):
        for side in (1, -1):
            hub.box((6.0, 0.06, 1.6), (side * 3.6, 0, z), "panel")
            hub.box((6.0, 0.1, 0.08), (side * 3.6, 0, z), "hazard")
    for i in range(3):
        a = math.radians(120 * i + 30)
        hub.box((2.4, 0.6, 0.6), (math.cos(a) * 3.0, math.sin(a) * 3.0, 0.6), "gunmetal", rot=(0, 0, math.degrees(a)))
        hub.box((0.3, 0.3, 0.3), (math.cos(a) * 4.3, math.sin(a) * 4.3, 0.6), "signal")
    station = hub.join()

    ring = Builder("Ring", mat)
    ring.torus(10.0, 0.8, "steel")
    ring.torus(10.0, 0.82, "steel_dark", segs=(48, 4))
    for i in range(4):
        a = math.radians(90 * i)
        ring.box((8.0, 0.4, 0.4), (math.cos(a) * 6.0, math.sin(a) * 6.0, 0), "gunmetal", rot=(0, 0, math.degrees(a)))
    for i in range(12):
        a = math.radians(30 * i)
        ring.box((0.3, 0.6, 0.3), (math.cos(a) * 10.0, math.sin(a) * 10.0, 0.82), "signal" if i % 3 == 0 else "holo")
    ring_ob = ring.join()
    ring_ob.parent = station
    return station


# ----------------------------------------------------------------- export ---


def export(path):
    kwargs = dict(filepath=path, export_format="GLB", export_apply=True, use_selection=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in props})


def preview(path, root):
    scene = bpy.context.scene
    objs = [root, *root.children_recursive]
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, radius = (lo + hi) / 2, (hi - lo).length / 2

    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.location = centre + Vector((1.0, -1.2, 0.8)).normalized() * radius * 3.0
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = next((e for e in engines if "EEVEE" in e), engines[0])
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 4.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("world")
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.03, 0.04, 0.08, 1.0)
    bg.inputs["Strength"].default_value = 2.0
    scene.world = world
    scene.render.resolution_x, scene.render.resolution_y = 640, 400
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = os.path.abspath(argv[0] if argv else ".")
    preview_dir = os.path.abspath(argv[1]) if len(argv) > 1 else None
    os.makedirs(out_dir, exist_ok=True)

    for name, build in (("barge", build_barge), ("frigate", build_frigate), ("pirate", build_pirate), ("station", build_station)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        root = build(make_material(*make_palette_images()))
        export(os.path.join(out_dir, f"{name}.glb"))
        tris = sum(len(p.vertices) - 2 for o in [root, *root.children_recursive] for p in o.data.polygons)
        print(f"MODEL {name}: {tris} triangles")
        if preview_dir:
            preview(os.path.join(preview_dir, f"{name}.png"), root)


main()
