"""Build the vertical slice's placeholder 3D models.

Run headless from the repository root:
    blender --background --factory-startup --python blender/scripts/build_placeholder_models.py -- public/assets/models [preview_dir] [model ...]

Each model is one mesh with one material sampling a shared colour palette
(base colour + emission), in the dark style (D-78, D-84). Ships face Blender -Y,
which the glTF exporter turns into +Z. The station's ring is a child object
named "Ring" so the game can spin it.

The frigate is the detailed exception (D-118): an original cruiser in the style
of EVE's Caracal, with two extra hull materials that carry a generated panel
texture and normal map.
"""

import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
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


# ------------------------------------------------------------ hull panels ---

HULL_PX = 512
HULL_WORLD = 2.5  # world units one hull texture tile covers
HULL_TONES = {"hull": (0.33, 0.37, 0.45), "hull_dark": (0.12, 0.14, 0.19)}


def _blur(a, r):
    """Box blur that wraps around, so the result still tiles."""
    for axis in (0, 1):
        a = sum(np.roll(a, k, axis) for k in range(-r, r + 1)) / (2 * r + 1)
    return a


def _tiling_noise(rng, cells):
    grid = rng.random((cells, cells))
    return _blur(np.kron(grid, np.ones((HULL_PX // cells, HULL_PX // cells))), HULL_PX // cells // 2)


def _panels(rng):
    """Splits the tile into rectangular plates: (x, y, w, h) in pixels."""
    out = []

    def split(x, y, w, h, depth):
        if depth > 1 and (max(w, h) < 48 or (depth > 3 and rng.random() < 0.35)):
            out.append((x, y, w, h))
            return
        horizontal = w >= h if rng.random() < 0.8 else w < h
        size = w if horizontal else h
        cut = int(size * rng.uniform(0.3, 0.7)) // 8 * 8
        if horizontal:
            split(x, y, cut, h, depth + 1)
            split(x + cut, y, w - cut, h, depth + 1)
        else:
            split(x, y, w, cut, depth + 1)
            split(x, y + cut, w, h - cut, depth + 1)

    split(0, 0, HULL_PX, HULL_PX, 0)
    return out


def make_hull_images(seed=7):
    """One panel layout, coloured in each hull tone, plus a shared normal map."""
    rng = np.random.default_rng(seed)
    height = np.ones((HULL_PX, HULL_PX))
    shade = np.zeros((HULL_PX, HULL_PX))
    marks = []
    for x, y, w, h in _panels(rng):
        shade[y:y + h, x:x + w] = rng.normal(0, 0.06)
        if w > 40 and h > 40 and rng.random() < 0.3:  # recessed inner plate
            height[y + 8:y + h - 8, x + 8:x + w - 8] = 0.75
        if rng.random() < 0.5:  # bolts in the corners
            for bx, by in ((x + 4, y + 4), (x + w - 6, y + 4), (x + 4, y + h - 6), (x + w - 6, y + h - 6)):
                height[by:by + 2, bx:bx + 2] = 0.6
        if w > 64 and rng.random() < 0.08:
            marks.append((x, y, w, h))
        height[y:y + 2, x:x + w] = 0.0  # seams on two sides; the neighbours supply the others
        height[y:y + h, x:x + 2] = 0.0

    grime = 0.55 * _tiling_noise(rng, 8) + 0.45 * _tiling_noise(rng, 32)
    seam = height == 0.0
    wear = (np.roll(seam, 1, 0) | np.roll(seam, 1, 1)) & ~seam  # light worn edge beside each seam

    images = {}
    for name, tone in HULL_TONES.items():
        light = (1 + shade) * (0.72 + 0.4 * grime)
        light = np.where(seam, 0.45, light) + np.where(wear, 0.12, 0.0)
        rgb = np.clip(np.array(tone)[None, None, :] * light[:, :, None], 0, 1)
        if name == "hull":  # sparse signal-red markings on the light plates
            for x, y, w, h in marks:
                rgb[y + 6:y + 10, x + 6:x + w - 6] = PALETTE["signal"][0]
        images[name] = _image(f"{name}_base", rgb, colour=True)

    h = _blur(height, 1)
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    n = np.dstack((-dx * 2.5, -dy * 2.5, np.ones_like(h)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    images["normal"] = _image("hull_normal", n * 0.5 + 0.5, colour=False)
    return images


def _image(name, rgb, colour):
    img = bpy.data.images.new(name, HULL_PX, HULL_PX, alpha=False)
    if not colour:
        img.colorspace_settings.name = "Non-Color"
    rgba = np.dstack((rgb, np.ones(rgb.shape[:2]))).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = "PNG"
    img.pack()
    return img


def make_hull_materials():
    images = make_hull_images()
    mats = {}
    for name in HULL_TONES:
        mat = bpy.data.materials.new(name)
        try:
            mat.use_nodes = True
        except AttributeError:
            pass
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Metallic"].default_value = 0.3
        bsdf.inputs["Roughness"].default_value = 0.7
        base = nodes.new("ShaderNodeTexImage")
        base.image = images[name]
        links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
        normal = nodes.new("ShaderNodeTexImage")
        normal.image = images["normal"]
        normal_map = nodes.new("ShaderNodeNormalMap")
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
        mats[name] = mat
    return mats


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

    def __init__(self, name, material, hull=None):
        self.name = name
        self.material = material
        self.hull = hull or {}  # hull tone name -> textured material
        self.parts = []
        self.rng = random.Random(name)

    def _finish(self, bm, colour, bevel=0.0):
        if bevel:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", clamp_overlap=True)
        uv = bm.loops.layers.uv.verify()
        if colour in self.hull:
            # box projection: each face takes the panel texture from its dominant axis,
            # shifted per part so neighbouring plates don't line up
            shift = (self.rng.random(), self.rng.random())
            for face in bm.faces:
                axis = max(range(3), key=lambda i: abs(face.normal[i]))
                a, b = [i for i in range(3) if i != axis]
                for loop in face.loops:
                    co = loop.vert.co
                    loop[uv].uv = (co[a] / HULL_WORLD + shift[0], co[b] / HULL_WORLD + shift[1])
        else:
            u, v = cell_uv(colour)
            for face in bm.faces:
                for loop in face.loops:
                    loop[uv].uv = (u, v)
        me = bpy.data.meshes.new(f"{self.name}_part")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(self.hull.get(colour, self.material))
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

    def loft(self, sections, colour, scale=(1, 1, 1), bevel=0.0):
        """Hull section skinned through cross-sections: [(y, [(x, z), ...]), ...], same point count each."""
        bm = bmesh.new()
        rings = [[bm.verts.new((x * scale[0], y * scale[1], z * scale[2])) for x, z in pts] for y, pts in sections]
        for a, b in zip(rings, rings[1:]):
            for i in range(len(a)):
                j = (i + 1) % len(a)
                bm.faces.new((a[i], a[j], b[j], b[i]))
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self._finish(bm, colour, bevel)

    def plate(self, outline, thickness, loc, colour, rot=(0, 0, 0), bevel=0.0):
        """Flat angular plate from an XY outline, given thickness along Z."""
        bm = bmesh.new()
        lo = [bm.verts.new((x, y, -thickness / 2)) for x, y in outline]
        hi = [bm.verts.new((x, y, thickness / 2)) for x, y in outline]
        for i in range(len(outline)):
            j = (i + 1) % len(outline)
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        bm.faces.new(lo)
        bm.faces.new(list(reversed(hi)))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.transform(bm, matrix=_xform(loc, rot, (1, 1, 1)), verts=bm.verts)
        self._finish(bm, colour, bevel)

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


def _hex(top, height, mid, bottom, depth):
    """Six-point angular cross-section: flat top and keel, widest at the waterline."""
    return [(-top, height), (top, height), (mid, 0), (bottom, -depth), (-bottom, -depth), (-mid, 0)]


# (y, top half-width, deck height, mid half-width, keel half-width, keel depth), nose to tail
CRUISER_HULL = [
    (-3.1, 0.05, 0.10, 0.12, 0.05, 0.06),
    (-2.2, 0.22, 0.32, 0.42, 0.20, 0.22),
    (-0.8, 0.34, 0.48, 0.62, 0.30, 0.36),
    (0.6, 0.38, 0.62, 0.70, 0.34, 0.42),
    (1.8, 0.42, 0.66, 0.74, 0.38, 0.46),
    (2.4, 0.40, 0.60, 0.70, 0.36, 0.44),
]


def _deck(y):
    """Deck height of the main hull at y."""
    for (y0, _, h0, *_), (y1, _, h1, *_) in zip(CRUISER_HULL, CRUISER_HULL[1:]):
        if y0 <= y <= y1:
            return h0 + (h1 - h0) * (y - y0) / (y1 - y0)
    return CRUISER_HULL[-1][2]


def build_frigate(mat, hull):
    """Frigate model (D-118): an original cruiser after EVE's Caracal. A dark faceted
    hull under lighter armour belts, a tall stepped superstructure and dorsal fin,
    twin forward missile arms, drooped wings and a heavy four-nozzle engine block."""
    b = Builder("frigate", mat, hull)
    sections = [(y, _hex(*rest)) for y, *rest in CRUISER_HULL]
    b.loft(sections, "hull_dark", bevel=0.012)
    # armour belts: slightly larger shells over parts of the hull read as layered plates
    for start, end, grow in ((1, 2, 1.07), (2, 4, 1.05)):
        belt = [(y, [(x * grow, z * grow) for x, z in pts]) for y, pts in sections[start:end + 1]]
        b.loft(belt, "hull", bevel=0.012)

    # stepped superstructure and the tall dorsal fin
    b.loft(
        [
            (-0.7, [(-0.30, 0.45), (0.30, 0.45), (0.10, 0.56), (-0.10, 0.56)]),
            (0.3, [(-0.32, 0.55), (0.32, 0.55), (0.18, 1.00), (-0.18, 1.00)]),
            (1.6, [(-0.34, 0.60), (0.34, 0.60), (0.20, 1.24), (-0.20, 1.24)]),
            (2.3, [(-0.30, 0.55), (0.30, 0.55), (0.16, 1.12), (-0.16, 1.12)]),
        ],
        "hull",
        bevel=0.01,
    )
    b.box((0.44, 1.0, 0.08), (0, 1.0, 1.27), "hull_dark", bevel=0.01)
    b.plate([(0, 0.6), (0, 2.5), (1.15, 2.6), (0.85, 1.6)], 0.07, (0, 0, 1.25), "hull_dark", rot=(0, -90, 0), bevel=0.01)
    b.plate([(0, -1.4), (0, 1.9), (-0.5, 2.1), (-0.42, -0.6)], 0.07, (0, 0, -0.38), "hull_dark", rot=(0, -90, 0))
    b.box((0.24, 0.05, 0.03), (0, -0.3, 0.745), "light_warm", rot=(24, 0, 0))  # bridge windows
    b.box((0.03, 0.03, 0.55), (0.08, 0.2, 1.3), "gunmetal")  # antennae
    b.box((0.03, 0.03, 0.35), (-0.1, 0.5, 1.4), "gunmetal")
    b.cone(0.14, 0.04, 0.08, (0, -0.55, 0.62), "steel", segments=12)  # sensor dish
    b.box((0.06, 0.06, 0.06), (0, 2.05, 2.2), "signal")  # fin-top beacon

    for side in (1, -1):
        sx = side * 1.0
        # forward missile arm on a strut
        b.loft(
            [
                (y, [(sx - w, -lo), (sx + w, -lo), (sx + w, hi), (sx - w, hi)])
                for y, w, hi, lo in ((-2.75, 0.05, 0.04, 0.07), (-2.2, 0.16, 0.16, 0.18), (0.0, 0.2, 0.2, 0.22), (0.6, 0.12, 0.13, 0.15))
            ],
            "hull",
            bevel=0.01,
        )
        b.box((0.5, 0.5, 0.18), (side * 0.72, 0.0, 0.0), "hull_dark", bevel=0.01)
        b.box((0.32, 0.9, 0.2), (sx, -1.25, 0.29), "hull_dark", bevel=0.01)  # launcher
        for col in (-0.08, 0.08):
            for row in (0.24, 0.34):
                b.box((0.06, 0.04, 0.06), (sx + col, -1.71, row), "black")
        b.box((0.02, 1.0, 0.03), (sx + side * 0.205, -0.6, 0.02), "signal")
        b.box((0.03, 0.03, 0.03), (sx, -2.74, 0.0), "signal" if side < 0 else "holo")

        # drooped, swept wing with a running light and a radiator row
        b.plate(
            [(side * 0.62, 0.5), (side * 1.95, 1.3), (side * 2.0, 1.95), (side * 0.66, 2.1)],
            0.06,
            (0, 0, -0.05),
            "hull",
            rot=(0, side * 12, 0),
            bevel=0.01,
        )
        b.box((0.05, 0.05, 0.05), (side * 1.98, 1.65, -0.45), "signal" if side < 0 else "holo")
        for i in range(5):
            b.box((0.02, 0.32, 0.22), (side * (0.34 + i * 0.045), 1.9, 0.72), "gunmetal")

        # lit window line along the chine
        for i in range(6):
            b.box((0.02, 0.12, 0.025), (side * 0.79, 0.5 + i * 0.22, 0.02), "light_warm")

        # small side engines at the wing roots
        b.cone(0.17, 0.13, 0.35, (side * 0.92, 2.55, 0.05), "gunmetal", rot=FORWARD, segments=10)
        b.cone(0.12, 0.0, 0.12, (side * 0.92, 2.76, 0.05), "engine_player", rot=BACKWARD, segments=10)

    # hull greebles: on the bow deck, and beside the superstructure further back
    for i in range(24):
        y = b.rng.uniform(-2.0, 2.3)
        side = b.rng.choice((1, -1))
        x = side * (b.rng.uniform(0.05, 0.22) if y < -0.75 else b.rng.uniform(0.3, 0.4))
        deck = _deck(y) * (1.05 if -0.8 < y < 1.8 else 1.0)
        w, l, hgt = b.rng.uniform(0.06, 0.12), b.rng.uniform(0.1, 0.25), b.rng.uniform(0.03, 0.07)
        b.box((w, l, hgt), (x, y, deck + hgt / 2), b.rng.choice(("gunmetal", "steel_dark", "hull")))

    # engine block: four main nozzles, hazard trim
    b.box((1.5, 0.8, 1.1), (0, 2.65, 0.1), "hull_dark", bevel=0.03)
    b.box((0.9, 0.6, 0.45), (0, 2.6, 0.82), "hull", bevel=0.02)
    for x in (0.74, -0.74):
        b.box((0.04, 0.82, 0.12), (x, 2.65, -0.25), "hazard")
    for x in (0.38, -0.38):
        for z in (-0.12, 0.36):
            b.cone(0.29, 0.22, 0.42, (x, 3.2, z), "gunmetal", rot=FORWARD, segments=12, bevel=0.01)
            b.cone(0.21, 0.0, 0.16, (x, 3.43, z), "engine_player", rot=BACKWARD, segments=12)

    ship = b.join()
    ship.data.transform(Matrix.Scale(0.78, 4))  # about 5 units long, a step up from the old 4.2
    return ship


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


def export(path, **extra):
    kwargs = dict(filepath=path, export_format="GLB", export_apply=True, use_selection=False, **extra)
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
    preview_dir = os.path.abspath(argv[1]) if len(argv) > 1 and argv[1] != "-" else None
    only = set(argv[2:])
    os.makedirs(out_dir, exist_ok=True)

    builds = (("barge", build_barge), ("frigate", build_frigate), ("pirate", build_pirate), ("station", build_station))
    for name, build in builds:
        if only and name not in only:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mat = make_material(*make_palette_images())
        if name == "frigate":
            root = build(mat, make_hull_materials())
            # the panel textures are photographic enough for JPEG; it keeps the file small
            export(os.path.join(out_dir, f"{name}.glb"), export_image_format="JPEG", export_jpeg_quality=88)
        else:
            root = build(mat)
            export(os.path.join(out_dir, f"{name}.glb"))
        tris = sum(len(p.vertices) - 2 for o in [root, *root.children_recursive] for p in o.data.polygons)
        print(f"MODEL {name}: {tris} triangles")
        if preview_dir:
            preview(os.path.join(preview_dir, f"{name}.png"), root)


main()
