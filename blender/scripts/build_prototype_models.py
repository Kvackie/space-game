"""Build the placeholder models used by the rendering prototypes.

Run headless:
    blender --background --factory-startup --python build_prototype_models.py -- <out_dir> [<preview_dir>]

Every model is one mesh with one material that samples a shared 4x4 colour
palette (base colour + emission), so each ship costs a single draw call and
can be instanced. Ships face Blender -Y, which the glTF exporter turns into +Z.
The station's ring is a separate child object named "Ring" so engines can spin it.
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

# index: (base colour sRGB, emission sRGB or None)
PALETTE = {
    "white": ((0.92, 0.94, 0.97), None),
    "grey": ((0.62, 0.66, 0.72), None),
    "dark": ((0.18, 0.20, 0.25), None),
    "blue": ((0.20, 0.60, 1.00), None),
    "pink": ((1.00, 0.35, 0.60), None),
    "gold": ((1.00, 0.78, 0.25), None),
    "red": ((0.90, 0.18, 0.20), None),
    "orange": ((1.00, 0.50, 0.10), None),
    "glass": ((0.40, 0.95, 1.00), (0.15, 0.40, 0.45)),
    "glow_cyan": ((0.50, 0.95, 1.00), (0.50, 0.95, 1.00)),
    "glow_orange": ((1.00, 0.55, 0.15), (1.00, 0.55, 0.15)),
    "panel": ((0.10, 0.20, 0.55), None),
    "glow_yellow": ((1.00, 0.90, 0.50), (1.00, 0.90, 0.50)),
    "enemy_dark": ((0.25, 0.12, 0.15), None),
    "purple": ((0.55, 0.35, 1.00), None),
    "black": ((0.05, 0.05, 0.07), None),
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
    bsdf.inputs["Metallic"].default_value = 0.15
    bsdf.inputs["Roughness"].default_value = 0.45
    texs = []
    for img, socket in ((base_img, "Base Color"), (emit_img, "Emission Color")):
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Closest"
        links.new(tex.outputs["Color"], bsdf.inputs[socket])
        texs.append(tex)
    bsdf.inputs["Emission Strength"].default_value = 2.0
    # Workbench previews show the active image node, so make that the base colour
    nodes.active = texs[0]
    return mat


# ------------------------------------------------------------------ parts ---

class Builder:
    """Collects parts as objects, then joins them into one mesh."""

    def __init__(self, name, material):
        self.name = name
        self.material = material
        self.parts = []

    def _finish(self, bm, colour, bevel):
        if bevel:
            bmesh.ops.bevel(
                bm, geom=list(bm.edges), offset=bevel, segments=1,
                affect="EDGES", profile=0.5, clamp_overlap=True,
            )
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
        return ob

    def box(self, size, loc, colour, rot=(0, 0, 0), bevel=0.0):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        m = _xform(loc, rot, size)
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        return self._finish(bm, colour, bevel)

    def cone(self, r1, r2, depth, loc, colour, rot=(0, 0, 0), scale=(1, 1, 1), segments=12, bevel=0.0):
        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=segments,
            radius1=r1, radius2=r2, depth=depth,
        )
        bmesh.ops.transform(bm, matrix=_xform(loc, rot, scale), verts=bm.verts)
        return self._finish(bm, colour, bevel)

    def sphere(self, r, loc, colour, scale=(1, 1, 1), rot=(0, 0, 0), segs=(16, 8)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=r)
        bmesh.ops.transform(bm, matrix=_xform(loc, rot, scale), verts=bm.verts)
        return self._finish(bm, colour, 0.0)

    def torus(self, major, minor, loc, colour, segs=(48, 10)):
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
        bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
        return self._finish(bm, colour, 0.0)

    def join(self):
        target = self.parts[0]
        with bpy.context.temp_override(
            active_object=target,
            selected_editable_objects=self.parts,
            selected_objects=self.parts,
        ):
            bpy.ops.object.join()
        target.name = self.name
        target.data.name = self.name
        return target


def _xform(loc, rot, scale):
    r = (
        Matrix.Rotation(math.radians(rot[2]), 4, "Z")
        @ Matrix.Rotation(math.radians(rot[1]), 4, "Y")
        @ Matrix.Rotation(math.radians(rot[0]), 4, "X")
    )
    s = Matrix.Diagonal((*scale, 1.0))
    return Matrix.Translation(loc) @ r @ s


# Cone axis is +Z; rotating +90 about X points its narrow end (radius2) at -Y (forward).
FORWARD = (90, 0, 0)
BACKWARD = (-90, 0, 0)

# ----------------------------------------------------------------- models ---


def build_frigate(mat):
    b = Builder("frigate", mat)
    b.cone(0.6, 0.12, 3.0, (0, -0.2, 0), "white", rot=FORWARD, scale=(1, 1, 0.45), segments=4)
    b.sphere(0.25, (0, -0.55, 0.2), "glass", scale=(0.8, 1.8, 0.6))
    b.box((2.6, 0.8, 0.07), (0, 0.6, 0), "blue")
    for x in (0.75, -0.75):
        b.cone(0.18, 0.18, 1.2, (x, 0.9, 0), "grey", rot=FORWARD, segments=8)
        b.cone(0.16, 0.0, 0.2, (x, 1.55, 0), "glow_cyan", rot=BACKWARD, segments=8)
    return b.join()


def build_enemy(mat):
    b = Builder("enemy", mat)
    b.sphere(0.7, (0, 0.2, 0), "enemy_dark", scale=(1.0, 1.4, 0.45), segs=(8, 6))
    for x in (0.45, -0.45):
        b.box((0.18, 2.2, 0.18), (x, -0.9, 0), "red")
        b.cone(0.12, 0.0, 0.35, (x, -2.15, 0), "orange", rot=FORWARD, segments=6)
    b.box((2.2, 0.5, 0.06), (0, 0.5, 0), "red", rot=(0, 0, 0))
    b.cone(0.3, 0.3, 0.6, (0, 1.2, 0), "dark", rot=FORWARD, segments=8)
    b.cone(0.26, 0.0, 0.25, (0, 1.6, 0), "glow_orange", rot=BACKWARD, segments=8)
    return b.join()


def build_hero(mat):
    b = Builder("hero", mat)
    # main hull: long faceted wedge with a raised spine
    b.cone(0.75, 0.1, 4.2, (0, -0.3, 0), "white", rot=FORWARD, scale=(1, 1, 0.42), segments=6, bevel=0.03)
    b.cone(0.28, 0.05, 3.0, (0, -0.2, 0.22), "blue", rot=FORWARD, scale=(1, 1, 0.6), segments=6, bevel=0.02)
    b.sphere(0.28, (0, -1.0, 0.3), "glass", scale=(0.7, 2.0, 0.55), segs=(20, 10))
    # swept wings with pink leading stripes
    for side in (1, -1):
        b.box((1.7, 1.1, 0.08), (side * 1.25, 0.5, -0.05), "white", rot=(0, side * -6, side * -28), bevel=0.02)
        b.box((1.6, 0.12, 0.1), (side * 1.18, 0.02, -0.03), "pink", rot=(0, side * -6, side * -28))
        b.box((0.08, 0.7, 0.6), (side * 0.55, 1.35, 0.35), "white", rot=(0, side * 15, 0), bevel=0.02)
        b.box((0.1, 0.3, 0.12), (side * 2.0, 0.85, -0.1), "gold")
        # engine pods
        b.cone(0.26, 0.22, 1.6, (side * 0.62, 1.05, -0.05), "grey", rot=FORWARD, segments=12, bevel=0.015)
        b.cone(0.27, 0.27, 0.12, (side * 0.62, 0.35, -0.05), "pink", rot=FORWARD, segments=12)
        b.cone(0.22, 0.0, 0.35, (side * 0.62, 1.95, -0.05), "glow_cyan", rot=BACKWARD, segments=12)
    b.cone(0.3, 0.0, 0.4, (0, 1.85, 0), "glow_cyan", rot=BACKWARD, segments=12)
    return b.join()


def build_station(mat):
    hub = Builder("station", mat)
    hub.cone(2.0, 2.0, 6.0, (0, 0, 0), "white", segments=16, bevel=0.05)
    hub.cone(2.0, 0.8, 1.5, (0, 0, 3.75), "grey", segments=16)
    hub.cone(0.8, 2.0, 1.5, (0, 0, -3.75), "grey", segments=16)
    hub.cone(2.05, 2.05, 0.4, (0, 0, 1.5), "blue", segments=16)
    hub.cone(2.05, 2.05, 0.4, (0, 0, -1.5), "blue", segments=16)
    hub.box((0.8, 0.8, 9.0), (0, 0, 0), "dark")
    for z in (5.0, -5.0):
        for side in (1, -1):
            hub.box((6.0, 0.05, 1.6), (side * 3.6, 0, z), "panel")
            hub.box((6.0, 0.08, 0.1), (side * 3.6, 0, z), "gold")
    for i in range(3):
        a = math.radians(120 * i + 30)
        x, y = math.cos(a) * 3.0, math.sin(a) * 3.0
        hub.box((2.2, 0.5, 0.5), (x, y, 0.6), "grey", rot=(0, 0, math.degrees(a)))
        hub.box((0.3, 0.3, 0.3), (math.cos(a) * 4.2, math.sin(a) * 4.2, 0.6), "glow_yellow")
    station = hub.join()

    ring = Builder("Ring", mat)
    ring.torus(10.0, 0.8, (0, 0, 0), "white")
    ring.torus(10.0, 0.82, (0, 0, 0), "blue", segs=(48, 4))
    for i in range(4):
        a = math.radians(90 * i)
        ring.box((8.0, 0.4, 0.4), (math.cos(a) * 6.0, math.sin(a) * 6.0, 0), "grey", rot=(0, 0, math.degrees(a)))
    for i in range(12):
        a = math.radians(30 * i)
        ring.box((0.3, 0.6, 0.3), (math.cos(a) * 10.0, math.sin(a) * 10.0, 0.8), "glow_yellow")
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

    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    direction = Vector((1.0, -1.2, 0.8)).normalized()
    cam.location = centre + direction * radius * 3.2
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    # EEVEE renders the real material (Workbench would show the emission texture)
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
    bg.inputs["Color"].default_value = (0.05, 0.07, 0.12, 1.0)
    bg.inputs["Strength"].default_value = 3.0
    scene.world = world
    scene.render.resolution_x, scene.render.resolution_y = 640, 400
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = os.path.abspath(argv[0] if argv else ".")
    preview_dir = os.path.abspath(argv[1]) if len(argv) > 1 else None
    os.makedirs(out_dir, exist_ok=True)

    for name, build in (
        ("frigate", build_frigate),
        ("enemy", build_enemy),
        ("hero", build_hero),
        ("station", build_station),
    ):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        base, emit = make_palette_images()
        root = build(make_material(base, emit))
        export(os.path.join(out_dir, f"{name}.glb"))
        tris = sum(len(p.vertices) - 2 for o in [root, *root.children_recursive] for p in o.data.polygons)
        print(f"MODEL {name}: {tris} triangles")
        if preview_dir:
            preview(os.path.join(preview_dir, f"{name}.png"), root)


main()
